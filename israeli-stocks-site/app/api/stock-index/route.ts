import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadTickerData() {
  const filePath = join(process.cwd(), 'public', 'data', 'stock-tickers.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// ── Rate limiter ──
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

// ── Yahoo Finance fetcher ──
async function yahooDaily(ticker: string, fromDate: Date): Promise<{ dates: string[]; opens: number[]; prices: number[] } | null> {
  try {
    const p1 = Math.floor(fromDate.getTime() / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=1d&includeAdjustedClose=true`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    const opens: number[] = quote?.open || [];
    const closes: number[] = quote?.close || [];
    if (!timestamps.length || !closes.length) return null;

    const dates = timestamps.map((t: number) => new Date(t * 1000).toISOString().split('T')[0]);
    return { dates, opens, prices: closes };
  } catch {
    return null;
  }
}

// ── Config ──
// Fetch from April 2 to get the last trading day before SA20 launch (April 6)
// TASE last trading day before April 6 = April 3 (Friday, Good Friday but TASE open)
// US last trading day before April 6 = April 2 (Thursday, Good Friday closed)
const INDEX_START = '2026-04-02';
const SA20_LAUNCH = '2026-04-06';
// Hardcoded fallback base FX rate (USD/ILS on SA20 launch April 6, 2026) — from Shlomi's spreadsheet
const FALLBACK_BASE_FX = 3.130375;
// Hardcoded base prices from Shlomi's spreadsheet (שער השקת מדד 06/04/26)
const BENCHMARKS = [
  { name: 'ת"א 125',    ticker: '^TA125.TA', color: '#60a5fa', currency: 'ILS', basePrice: 4107.92 },
  { name: 'S&P 500',     ticker: '^GSPC',     color: '#f59e0b', currency: 'USD', basePrice: 6582.69 },
  { name: 'Nasdaq 100',  ticker: '^NDX',      color: '#a78bfa', currency: 'USD', basePrice: 0 },
  { name: 'MSCI World',  ticker: 'URTH',      color: '#f472b6', currency: 'USD', basePrice: 0 },
];

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const periodStart = new Date(INDEX_START);
    const tickerData = loadTickerData();
    const stocks: Array<{ name: string; ticker: string; basePrice?: number; dividends?: number }> = tickerData.stocks;

    // ── Fetch everything in parallel ──
    const [stockResults, fxResult, ...benchmarkResults] = await Promise.all([
      // SA20 stocks
      Promise.allSettled(
        stocks.map(async (s) => ({
          name: s.name,
          ticker: s.ticker,
          history: await yahooDaily(s.ticker, periodStart),
        }))
      ),
      // USD/ILS exchange rate
      yahooDaily('USDILS=X', periodStart),
      // Benchmarks
      ...BENCHMARKS.map(async (b) => ({
        ...b,
        history: await yahooDaily(b.ticker, periodStart),
      })),
    ]);

    // ── Build FX rate map (date → USD/ILS closing rate) ──
    const fxMap = new Map<string, number>();
    if (fxResult) {
      for (let i = 0; i < fxResult.dates.length; i++) {
        const r = fxResult.prices[i];
        if (r != null && !isNaN(r) && r > 0) fxMap.set(fxResult.dates[i], r);
      }
    }

    // Find nearest FX rate (handles weekends/holidays)
    function getFx(date: string): number | null {
      const exact = fxMap.get(date);
      if (exact) return exact;
      const d = new Date(date);
      for (let i = 1; i <= 7; i++) {
        d.setDate(d.getDate() - 1);
        const r = fxMap.get(d.toISOString().split('T')[0]);
        if (r) return r;
      }
      return null;
    }

    // ── SA20 index ──
    const stockHistories: Array<{ name: string; ticker: string; dates: string[]; opens: number[]; prices: number[] }> = [];
    for (const r of stockResults) {
      if (r.status === 'fulfilled' && r.value.history) {
        stockHistories.push({ name: r.value.name, ticker: r.value.ticker, ...r.value.history });
      }
    }

    // Build per-stock price maps with HARDCODED base prices from Shlomi's spreadsheet
    // These are the exact "שער השקת מדד 06/04/26" values — guaranteed to match
    const basePriceMap = new Map<string, number>();
    const dividendMap = new Map<string, number>();
    for (const s of stocks) {
      if (s.basePrice) basePriceMap.set(s.ticker, s.basePrice);
      if (s.dividends) dividendMap.set(s.ticker, s.dividends);
    }

    const stockMaps = stockHistories.map((sh) => {
      const map = new Map<string, number>();
      for (let i = 0; i < sh.dates.length; i++) {
        if (sh.prices[i] != null && !isNaN(sh.prices[i])) map.set(sh.dates[i], sh.prices[i]);
      }

      // Use hardcoded base price from JSON (Shlomi's spreadsheet values)
      const basePrice = basePriceMap.get(sh.ticker) || 0;
      const dividends = dividendMap.get(sh.ticker) || 0;

      return { name: sh.name, ticker: sh.ticker, map, basePrice, dividends };
    });

    // Collect all dates
    const allDatesSet = new Set<string>();
    stockHistories.forEach((sh) => sh.dates.forEach((d) => allDatesSet.add(d)));
    benchmarkResults.forEach((br) => { if (br.history) br.history.dates.forEach((d: string) => allDatesSet.add(d)); });
    const allDates = Array.from(allDatesSet).sort();

    // SA20: equal-weight average % change, base 1000
    // Display starts from April 6 even though base prices are from pre-launch
    const sa20Series: Array<{ date: string; value: number }> = [];
    for (const date of allDates) {
      if (date < SA20_LAUNCH) continue; // Skip pre-launch dates
      let totalPct = 0, count = 0;
      for (const sm of stockMaps) {
        if (sm.basePrice <= 0) continue;
        const p = sm.map.get(date);
        if (p != null && !isNaN(p)) {
          // Return = ((price + dividends) / basePrice) - 1
          totalPct += (((p + sm.dividends) / sm.basePrice) - 1) * 100;
          count++;
        }
      }
      if (count > 0) {
        sa20Series.push({ date, value: Math.round(1000 * (1 + totalPct / count / 100) * 10) / 10 });
      }
    }

    // ── Benchmarks ──
    // For USD benchmarks: convert to ILS performance
    // Formula: ILS_return = (index_today/index_base) × (fx_today/fx_base) - 1
    // This correctly combines the index % change with the currency % change

    const benchmarkDebug: Record<string, unknown> = {};
    const benchmarkSeries = benchmarkResults.map((br) => {
      if (!br.history) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const { dates, prices, opens } = br.history;

      // For TASE benchmarks (TA-125): use opening price ON April 6 (TASE trades Sundays)
      // For US benchmarks (S&P, Nasdaq, MSCI): use closing price of last trading day before April 6
      const isTASE = br.ticker.endsWith('.TA');

      let baseIdx = -1;

      if (isTASE) {
        // 1st: opening price ON April 6
        for (let i = 0; i < dates.length; i++) {
          if (dates[i] === SA20_LAUNCH && opens[i] != null && !isNaN(opens[i]) && opens[i] > 0) {
            baseIdx = i;
            break;
          }
        }
      }

      // For US indices, or fallback for TASE: closing price of last day before April 6
      if (baseIdx < 0) {
        for (let i = dates.length - 1; i >= 0; i--) {
          if (dates[i] < SA20_LAUNCH && prices[i] != null && !isNaN(prices[i]) && prices[i] > 0) {
            baseIdx = i;
            break;
          }
        }
      }
      // Final fallback
      if (baseIdx < 0) {
        for (let i = 0; i < prices.length; i++) {
          if (prices[i] != null && !isNaN(prices[i]) && prices[i] > 0) {
            baseIdx = i;
            break;
          }
        }
      }
      if (baseIdx < 0) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      // Use hardcoded base price from Shlomi's spreadsheet if available
      // Otherwise fall back to: TASE=open on April 6, US=close before April 6
      const fallbackPrice = (isTASE && dates[baseIdx] === SA20_LAUNCH) ? opens[baseIdx] : prices[baseIdx];
      const basePrice = (br.basePrice && br.basePrice > 0) ? br.basePrice : fallbackPrice;
      const baseDate = dates[baseIdx];

      const needsFx = br.currency === 'USD';
      // FX base: use the rate closest to SA20 launch date (April 6), NOT the benchmark's base date
      // This ensures FX conversion measures currency change from the same starting point
      const baseFx = needsFx ? (getFx(SA20_LAUNCH) || getFx(baseDate) || FALLBACK_BASE_FX) : null;

      // Find last valid price for debug
      let lastIdx = -1;
      for (let i = prices.length - 1; i >= 0; i--) {
        if (prices[i] != null && !isNaN(prices[i]) && prices[i] > 0) {
          lastIdx = i;
          break;
        }
      }
      const lastPrice = lastIdx >= 0 ? prices[lastIdx] : basePrice;
      const lastDate = lastIdx >= 0 ? dates[lastIdx] : baseDate;
      const lastFx = needsFx ? getFx(lastDate) : null;

      // Debug info per benchmark
      benchmarkDebug[br.name] = {
        baseDate,
        basePrice: Math.round(basePrice * 100) / 100,
        basePriceType: 'close',
        lastDate,
        lastPrice: Math.round(lastPrice * 100) / 100,
        indexChangePct: Math.round(((lastPrice / basePrice) - 1) * 10000) / 100,
        ...(needsFx ? {
          baseFx: baseFx ? Math.round(baseFx * 10000) / 10000 : null,
          baseFxSource: getFx(SA20_LAUNCH) ? 'SA20_LAUNCH' : getFx(baseDate) ? 'baseDate' : 'FALLBACK',
          lastFx: lastFx ? Math.round(lastFx * 10000) / 10000 : null,
          fxChangePct: baseFx && lastFx ? Math.round(((lastFx / baseFx) - 1) * 10000) / 100 : null,
          ilsReturnPct: baseFx && lastFx ? Math.round(((lastPrice / basePrice) * (lastFx / baseFx) - 1) * 10000) / 100 : null,
          shlomiExpected: br.name === 'S&P 500' ? '-3.22%' : undefined,
        } : {
          returnPct: Math.round(((lastPrice / basePrice) - 1) * 10000) / 100,
        }),
        totalDataPoints: dates.length,
      };

      const data: Array<{ date: string; value: number }> = [];
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] < SA20_LAUNCH) continue; // Skip pre-launch dates
        const p = prices[i];
        if (p == null || isNaN(p)) continue;

        if (needsFx && baseFx) {
          // USD→ILS: multiply the index ratio by the FX ratio
          const todayFx = getFx(dates[i]);
          if (!todayFx) continue;
          const ilsReturn = (p / basePrice) * (todayFx / baseFx);
          data.push({ date: dates[i], value: Math.round(1000 * ilsReturn * 10) / 10 });
        } else {
          // ILS benchmark (TA-125) — direct % change
          const pctChange = (p - basePrice) / basePrice;
          data.push({ date: dates[i], value: Math.round(1000 * (1 + pctChange) * 10) / 10 });
        }
      }
      return { name: br.name, ticker: br.ticker, color: br.color, data };
    });

    // ── Individual stock performance ──
    // Return = ((current_price + dividends) / base_price) - 1
    const stockPerformance = stockMaps
      .filter((sm) => sm.basePrice > 0)
      .map((sm) => {
        const entries = Array.from(sm.map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        const latestPrice = entries[0]?.[1] || sm.basePrice;
        const pctChange = (((latestPrice + sm.dividends) / sm.basePrice) - 1) * 100;
        return { name: sm.name, ticker: sm.ticker, pctChange: Math.round(pctChange * 100) / 100, latestPrice };
      });

    const successTickers = stockHistories.map((s) => s.ticker);
    const failedTickers = stocks
      .filter((s) => !successTickers.includes(s.ticker))
      .map((s) => ({ name: s.name, ticker: s.ticker }));

    return NextResponse.json({
      sa20: sa20Series,
      benchmarks: benchmarkSeries,
      stockPerformance,
      stockCount: stockHistories.length,
      totalStocks: stocks.length,
      failedTickers,
      lastUpdated: new Date().toISOString(),
      startDate: INDEX_START,
      fxRatesCount: fxMap.size,
      baseFxRate: getFx(allDates[0]),
      latestFxRate: getFx(allDates[allDates.length - 1]),
      benchmarkDebug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
