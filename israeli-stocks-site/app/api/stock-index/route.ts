import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadTickerData() {
  const filePath = join(process.cwd(), 'public', 'data', 'stock-tickers.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// No route-level caching — always fetch fresh data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

// ── Simple in-memory rate limiter ──────────────────────────────────────────
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
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

/* Index inception date: April 6, 2026 */
const INDEX_START = '2026-04-06';

function getPeriodStart(): Date {
  return new Date(INDEX_START);
}

/* ── TASE Official API — primary source for Israeli stocks ── */
// Uses the same API as market.tase.co.il — no authentication required
// Returns official TASE closing prices

interface TaseHistoryItem {
  // TASE API response fields — we try multiple possible field names
  [key: string]: unknown;
}

// Store debug info from first TASE API call
let taseDebugInfo: { status?: number; statusText?: string; body?: unknown; error?: string } | null = null;

async function fetchTaseHistory(
  taseId: number,
  startDate: string
): Promise<{ dates: string[]; prices: number[] } | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = 'https://api.tase.co.il/api/security/historyeod';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'referer': 'https://www.tase.co.il/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        dFrom: startDate,
        dTo: today,
        oId: String(taseId),
        pageNum: 1,
        pType: '8',
        TotalRec: 1,
        lang: '1',
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (!taseDebugInfo) {
        taseDebugInfo = { status: res.status, statusText: res.statusText };
        try { taseDebugInfo.body = await res.text(); } catch { /* ignore */ }
      }
      return null;
    }

    const data = await res.json();

    // Capture first successful response structure for debugging
    if (!taseDebugInfo) {
      const keys = Object.keys(data || {});
      const firstItem = (data?.Items || data?.items || [])[0];
      taseDebugInfo = {
        status: res.status,
        body: {
          topLevelKeys: keys,
          firstItemKeys: firstItem ? Object.keys(firstItem) : [],
          firstItemSample: firstItem || null,
          totalItems: (data?.Items || data?.items || []).length,
        },
      };
    }

    const items: TaseHistoryItem[] = data?.Items || data?.items || [];
    if (items.length === 0) return null;

    const dates: string[] = [];
    const prices: number[] = [];

    for (const item of items) {
      // Try multiple possible field names for date
      const dateVal =
        item.TradeDate || item.tradeDate || item.Date || item.date || item.TrdDate;
      // Try multiple possible field names for closing price
      // TASE typically uses "CloseRate" or "ClosingRate" or "BaseRate" or "AdjustedClosingPrice"
      const priceVal =
        item.CloseRate ?? item.closeRate ??
        item.ClosingRate ?? item.closingRate ??
        item.BaseRate ?? item.baseRate ??
        item.AdjustedClosingPrice ?? item.adjustedClosingPrice ??
        item.ClosingPrice ?? item.closingPrice ??
        item.Close ?? item.close ??
        item.LastRate ?? item.lastRate;

      if (dateVal == null || priceVal == null) continue;

      // Parse date — could be ISO string, timestamp, or "DD/MM/YYYY"
      let dateStr: string;
      const dv = String(dateVal);
      if (dv.includes('T')) {
        // ISO format: "2026-04-06T00:00:00"
        dateStr = dv.split('T')[0];
      } else if (dv.includes('/')) {
        // DD/MM/YYYY format
        const parts = dv.split('/');
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dv)) {
        dateStr = dv;
      } else {
        // Might be a timestamp
        const d = new Date(dateVal as string | number);
        dateStr = d.toISOString().split('T')[0];
      }

      const price = typeof priceVal === 'number' ? priceVal : parseFloat(String(priceVal));
      if (!isNaN(price) && price > 0) {
        dates.push(dateStr);
        prices.push(price);
      }
    }

    // TASE API returns newest first — reverse to chronological order
    if (dates.length > 1 && dates[0] > dates[dates.length - 1]) {
      dates.reverse();
      prices.reverse();
    }

    return dates.length > 0 ? { dates, prices } : null;
  } catch {
    return null;
  }
}

/* ── Yahoo Finance — fallback for Israeli stocks + primary for US benchmarks ── */

async function fetchYahooHistory(
  ticker: string,
  periodStart: Date
): Promise<{ dates: string[]; prices: number[] } | null> {
  try {
    const period1 = Math.floor(periodStart.getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
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

/* ── USD/ILS exchange rate fetching ── */

// Bank of Israel official API
async function fetchBoiRates(startDate: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STAT/EXR/1.0/RER_USD_ILS?startperiod=${startDate}&endperiod=${today}&format=sdmx-json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return map;
    const data = await res.json();

    const series = data?.data?.dataSets?.[0]?.series;
    const timePeriods =
      data?.data?.structure?.dimensions?.observation?.[0]?.values;

    if (series && timePeriods) {
      const seriesKey = Object.keys(series)[0];
      const obs = series[seriesKey]?.observations;
      if (obs) {
        for (const [idx, values] of Object.entries(obs)) {
          const period = timePeriods[parseInt(idx)]?.id;
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
async function fetchYahooFxRates(
  periodStart: Date
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const tickers = ['USDILS=X', 'ILS=X'];
  for (const ticker of tickers) {
    const result = await fetchYahooHistory(ticker, periodStart);
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

/* Helper: find nearest FX rate for a date (handles weekends/holidays) */
function getNearestFxRate(
  fxMap: Map<string, number>,
  date: string
): number | null {
  // Exact match
  const exact = fxMap.get(date);
  if (exact != null) return exact;

  // Look backwards up to 5 days for nearest rate
  const d = new Date(date);
  for (let i = 1; i <= 5; i++) {
    d.setDate(d.getDate() - 1);
    const key = d.toISOString().split('T')[0];
    const rate = fxMap.get(key);
    if (rate != null) return rate;
  }
  return null;
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
    // Reset debug info for this request
    taseDebugInfo = null;

    const periodStart = getPeriodStart();
    const tickerData = loadTickerData();
    const stocks = tickerData.stocks as Array<{
      name: string;
      ticker: string;
      taseId?: number;
    }>;

    // ── Fetch Israeli stocks: TASE API primary, Yahoo fallback ──
    const stockResults = await Promise.allSettled(
      stocks.map(async (stock) => {
        let history: { dates: string[]; prices: number[] } | null = null;
        let source = 'none';

        // Try TASE official API first (if we have taseId)
        if (stock.taseId) {
          history = await fetchTaseHistory(stock.taseId, INDEX_START);
          if (history) source = 'tase';
        }

        // Fallback to Yahoo Finance
        if (!history) {
          history = await fetchYahooHistory(stock.ticker, periodStart);
          if (history) source = 'yahoo';
        }

        return { name: stock.name, ticker: stock.ticker, history, source };
      })
    );

    // ── Fetch benchmarks (always from Yahoo) ──
    const benchmarkResults = await Promise.all(
      BENCHMARKS.map(async (b) => {
        const history = await fetchYahooHistory(b.ticker, periodStart);
        return {
          name: b.name,
          ticker: b.ticker,
          color: b.color,
          currency: b.currency,
          history,
        };
      })
    );

    // ── Fetch USD/ILS exchange rate — BOI first, Yahoo fallback ──
    let usdIlsMap = await fetchBoiRates(INDEX_START);
    let fxSource = usdIlsMap.size > 0 ? 'bank-of-israel' : '';

    if (usdIlsMap.size === 0) {
      usdIlsMap = await fetchYahooFxRates(periodStart);
      fxSource = usdIlsMap.size > 0 ? 'yahoo-finance' : 'none';
    }

    // ── SA20 index calculation ──
    const stockHistories: Array<{
      name: string;
      ticker: string;
      dates: string[];
      prices: number[];
      source: string;
    }> = [];
    for (const result of stockResults) {
      if (result.status === 'fulfilled' && result.value.history) {
        const { name, ticker, history, source } = result.value;
        stockHistories.push({
          name,
          ticker,
          dates: history.dates,
          prices: history.prices,
          source,
        });
      }
    }

    // All unique dates across everything
    const allDatesSet = new Set<string>();
    stockHistories.forEach((sh) =>
      sh.dates.forEach((d) => allDatesSet.add(d))
    );
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
      return {
        name: sh.name,
        ticker: sh.ticker,
        map,
        basePrice: basePrice || 0,
        source: sh.source,
      };
    });

    // SA20: base-1000 index
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
        sa20Series.push({
          date,
          value: Math.round(1000 * (1 + avgPct / 100) * 10) / 10,
        });
      }
    }

    // ── Benchmark series (with USD→ILS conversion where needed) ──
    const benchmarkSeries = benchmarkResults.map((br) => {
      if (!br.history)
        return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const currency = br.currency || 'unknown';
      const needsConversion = currency === 'USD' && usdIlsMap.size > 0;

      const rawDates = br.history.dates;
      const rawPrices = br.history.prices;

      let dates = rawDates;
      let prices = rawPrices;

      if (needsConversion) {
        const convDates: string[] = [];
        const convPrices: number[] = [];
        for (let i = 0; i < rawDates.length; i++) {
          const p = rawPrices[i];
          // Use nearest FX rate to handle weekends/holidays mismatch
          const rate = getNearestFxRate(usdIlsMap, rawDates[i]);
          if (p != null && !isNaN(p) && rate != null) {
            convDates.push(rawDates[i]);
            convPrices.push(p * rate);
          }
        }
        dates = convDates;
        prices = convPrices;
      }

      const basePrice = prices.find(
        (p: number) => p != null && !isNaN(p) && p > 0
      );
      if (!basePrice)
        return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const data: Array<{ date: string; value: number }> = [];
      for (let i = 0; i < dates.length; i++) {
        const p = prices[i];
        if (p != null && !isNaN(p)) {
          const pctChange = ((p - basePrice) / basePrice) * 100;
          data.push({
            date: dates[i],
            value: Math.round(1000 * (1 + pctChange / 100) * 10) / 10,
          });
        }
      }
      return { name: br.name, ticker: br.ticker, color: br.color, data };
    });

    // Individual stock performance
    const stockPerformance = stockMaps
      .filter((sm) => sm.basePrice > 0)
      .map((sm) => {
        const entries = Array.from(sm.map.entries()).sort((a, b) =>
          b[0].localeCompare(a[0])
        );
        const latestPrice = entries[0]?.[1] || sm.basePrice;
        const pctChange = ((latestPrice - sm.basePrice) / sm.basePrice) * 100;
        return {
          name: sm.name,
          ticker: sm.ticker,
          pctChange: Math.round(pctChange * 100) / 100,
          latestPrice,
          source: sm.source,
        };
      });

    const successTickers = stockHistories.map((s) => s.ticker);
    const failedTickers = stocks
      .filter((s) => !successTickers.includes(s.ticker))
      .map((s) => ({ name: s.name, ticker: s.ticker }));

    // Data source summary
    const taseCount = stockHistories.filter((s) => s.source === 'tase').length;
    const yahooCount = stockHistories.filter(
      (s) => s.source === 'yahoo'
    ).length;

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
      dataSource: {
        taseStocks: taseCount,
        yahooStocks: yahooCount,
        totalFetched: stockHistories.length,
      },
      taseDebug: taseDebugInfo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
