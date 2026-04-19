import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadTickerData() {
  const filePath = join(process.cwd(), 'public', 'data', 'stock-tickers.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// Cache the result for 1 hour (Vercel edge cache)
export const revalidate = 3600;

// ── Simple in-memory rate limiter ──────────────────────────────────────────
// Allows MAX_REQUESTS per IP per WINDOW_MS.  Resets automatically per window.
const WINDOW_MS = 60_000;   // 1 minute window
const MAX_REQUESTS = 20;    // max 20 calls / minute per IP (well above normal use)

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        adjclose: Array<{ adjclose: number[] }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

/* Benchmark indices — currency: 'USD' means we need to convert to ILS */
const BENCHMARKS = [
  { name: 'ת"א 125', ticker: '^TA125.TA', color: '#60a5fa', currency: 'ILS' },
  { name: 'S&P 500', ticker: '^GSPC', color: '#f59e0b', currency: 'USD' },
  { name: 'Nasdaq 100', ticker: '^NDX', color: '#a78bfa', currency: 'USD' },
  { name: 'MSCI World', ticker: 'URTH', color: '#f472b6', currency: 'USD' },
];

/* ── USD/ILS exchange rate fetching ── */

// Fetch daily USD/ILS rates from Bank of Israel official API
async function fetchBoiRates(startDate: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STAT/EXR/1.0/RER_USD_ILS?startperiod=${startDate}&endperiod=${today}&format=sdmx-json`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return map;
    const data = await res.json();

    // SDMX-JSON structure: data.dataSets[0].series["0:0:0:0"].observations
    const series = data?.data?.dataSets?.[0]?.series;
    const timePeriods = data?.data?.structure?.dimensions?.observation?.[0]?.values;

    if (series && timePeriods) {
      const seriesKey = Object.keys(series)[0];
      const obs = series[seriesKey]?.observations;
      if (obs) {
        for (const [idx, values] of Object.entries(obs)) {
          const period = timePeriods[parseInt(idx)]?.id; // "2026-04-06" format
          const rate = (values as number[])[0];
          if (period && rate && !isNaN(rate)) {
            map.set(period, rate);
          }
        }
      }
    }
  } catch {
    // BOI failed, will try Yahoo fallback
  }
  return map;
}

// Yahoo Finance forex fallback
async function fetchYahooFxRates(periodStart: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const tickers = ['USDILS=X', 'ILS=X'];
  for (const ticker of tickers) {
    const result = await fetchHistory(ticker, periodStart);
    if (result && result.dates.length > 0) {
      for (let i = 0; i < result.dates.length; i++) {
        const rate = result.prices[i];
        if (rate != null && !isNaN(rate) && rate > 0) {
          map.set(result.dates[i], rate);
        }
      }
      break;
    }
  }
  return map;
}

/* Index inception date: April 6, 2026 */
const INDEX_START = '2026-04-06';

function getPeriodStart(): Date {
  return new Date(INDEX_START);
}

async function fetchHistory(ticker: string, periodStart: Date): Promise<{ dates: string[]; prices: number[] } | null> {
  try {
    const period1 = Math.floor(periodStart.getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const data: YahooChartResult = await res.json();
    if (!data.chart?.result?.[0]) return null;

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.adjclose?.[0]?.adjclose || [];

    if (timestamps.length === 0 || closes.length === 0) return null;

    const dates = timestamps.map((t: number) => {
      const d = new Date(t * 1000);
      return d.toISOString().split('T')[0];
    });

    return { dates, prices: closes };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const periodStart = getPeriodStart();

    const tickerData = loadTickerData();
    const stocks = tickerData.stocks;

    // Fetch all stock histories + benchmarks + USD/ILS in parallel
    const [stockResults, ...benchmarkResults] = await Promise.all([
      // SA20 stocks
      Promise.allSettled(
        stocks.map(async (stock: { name: string; ticker: string }) => {
          const history = await fetchHistory(stock.ticker, periodStart);
          return { name: stock.name, ticker: stock.ticker, history };
        })
      ),
      // Benchmarks
      ...BENCHMARKS.map(async (b) => {
        const history = await fetchHistory(b.ticker, periodStart);
        return { name: b.name, ticker: b.ticker, color: b.color, currency: b.currency, history };
      }),
    ]);

    // Fetch USD/ILS exchange rate — Bank of Israel first, Yahoo fallback
    let usdIlsMap = await fetchBoiRates(INDEX_START);
    let fxSource = usdIlsMap.size > 0 ? 'bank-of-israel' : '';

    if (usdIlsMap.size === 0) {
      usdIlsMap = await fetchYahooFxRates(periodStart);
      fxSource = usdIlsMap.size > 0 ? 'yahoo-finance' : 'none';
    }

    // ── SA20 index calculation ──
    const stockHistories: Array<{ name: string; ticker: string; dates: string[]; prices: number[] }> = [];
    for (const result of stockResults) {
      if (result.status === 'fulfilled' && result.value.history) {
        const { name, ticker, history } = result.value;
        stockHistories.push({ name, ticker, dates: history.dates, prices: history.prices });
      }
    }

    // All unique dates across everything
    const allDatesSet = new Set<string>();
    stockHistories.forEach((sh) => sh.dates.forEach((d) => allDatesSet.add(d)));
    benchmarkResults.forEach((br) => {
      if (br.history) br.history.dates.forEach((d: string) => allDatesSet.add(d));
    });
    const allDates = Array.from(allDatesSet).sort();

    // SA20: average % change
    const stockMaps = stockHistories.map((sh) => {
      const map = new Map<string, number>();
      for (let i = 0; i < sh.dates.length; i++) {
        if (sh.prices[i] != null && !isNaN(sh.prices[i])) {
          map.set(sh.dates[i], sh.prices[i]);
        }
      }
      const basePrice = sh.prices.find((p) => p != null && !isNaN(p) && p > 0);
      return { name: sh.name, ticker: sh.ticker, map, basePrice: basePrice || 0 };
    });

    // SA20: base-1000 index (like investing 1000₪ on inception date)
    const sa20Series: Array<{ date: string; value: number }> = [];
    for (const date of allDates) {
      let totalPctChange = 0;
      let count = 0;
      for (const sm of stockMaps) {
        if (sm.basePrice <= 0) continue;
        const price = sm.map.get(date);
        if (price != null && !isNaN(price)) {
          totalPctChange += ((price - sm.basePrice) / sm.basePrice) * 100;
          count++;
        }
      }
      if (count > 0) {
        const avgPct = totalPctChange / count;
        sa20Series.push({ date, value: Math.round((1000 * (1 + avgPct / 100)) * 10) / 10 });
      }
    }

    // ── Benchmark series (with USD→ILS conversion where needed) ──
    const conversionDebug: Array<{ name: string; currency: string; needsConversion: boolean; fxMapSize: number; rawFirst: number | null; rawLast: number | null; convertedFirst: number | null; convertedLast: number | null; rateFirst: number | null; rateLast: number | null; dateFirst: string | null; dateLast: string | null }> = [];

    const benchmarkSeries = benchmarkResults.map((br) => {
      if (!br.history) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const currency = br.currency || 'unknown';
      const needsConversion = currency === 'USD' && usdIlsMap.size > 0;

      const rawDates = br.history.dates;
      const rawPrices = br.history.prices;

      let dates = rawDates;
      let prices = rawPrices;

      const debugEntry: typeof conversionDebug[0] = {
        name: br.name,
        currency,
        needsConversion,
        fxMapSize: usdIlsMap.size,
        rawFirst: rawPrices[0] ?? null,
        rawLast: rawPrices[rawPrices.length - 1] ?? null,
        convertedFirst: null,
        convertedLast: null,
        rateFirst: rawDates[0] ? (usdIlsMap.get(rawDates[0]) ?? null) : null,
        rateLast: rawDates[rawDates.length - 1] ? (usdIlsMap.get(rawDates[rawDates.length - 1]) ?? null) : null,
        dateFirst: rawDates[0] ?? null,
        dateLast: rawDates[rawDates.length - 1] ?? null,
      };

      if (needsConversion) {
        const convDates: string[] = [];
        const convPrices: number[] = [];
        for (let i = 0; i < rawDates.length; i++) {
          const p = rawPrices[i];
          const rate = usdIlsMap.get(rawDates[i]);
          if (p != null && !isNaN(p) && rate != null) {
            convDates.push(rawDates[i]);
            convPrices.push(p * rate);
          }
        }
        dates = convDates;
        prices = convPrices;
        debugEntry.convertedFirst = convPrices[0] ?? null;
        debugEntry.convertedLast = convPrices[convPrices.length - 1] ?? null;
      }

      conversionDebug.push(debugEntry);

      const basePrice = prices.find((p: number) => p != null && !isNaN(p) && p > 0);
      if (!basePrice) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const data: Array<{ date: string; value: number }> = [];
      for (let i = 0; i < dates.length; i++) {
        const p = prices[i];
        if (p != null && !isNaN(p)) {
          const pctChange = ((p - basePrice) / basePrice) * 100;
          data.push({
            date: dates[i],
            value: Math.round((1000 * (1 + pctChange / 100)) * 10) / 10,
          });
        }
      }
      return { name: br.name, ticker: br.ticker, color: br.color, data };
    });

    // Individual stock perf
    const stockPerformance = stockMaps
      .filter((sm) => sm.basePrice > 0)
      .map((sm) => {
        const entries = Array.from(sm.map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        const latestPrice = entries[0]?.[1] || sm.basePrice;
        const pctChange = ((latestPrice - sm.basePrice) / sm.basePrice) * 100;
        return {
          name: sm.name,
          ticker: sm.ticker,
          pctChange: Math.round(pctChange * 100) / 100,
          latestPrice,
        };
      });

    const successTickers = stockHistories.map((s) => s.ticker);
    const failedTickers = stocks
      .filter((s: { ticker: string }) => !successTickers.includes(s.ticker))
      .map((s: { name: string; ticker: string }) => ({ name: s.name, ticker: s.ticker }));

    return NextResponse.json({
      sa20: sa20Series,
      benchmarks: benchmarkSeries,
      stockPerformance,
      stockCount: stockHistories.length,
      totalStocks: stocks.length,
      failedTickers,
      lastUpdated: new Date().toISOString(),
      startDate: INDEX_START,
      fxSource: fxSource || 'none',
      fxRatesCount: usdIlsMap.size,
      fxRates: Object.fromEntries(usdIlsMap),
      conversionDebug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
