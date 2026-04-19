import { NextResponse } from 'next/server';
import {
  SA20_LAUNCH_DATE,
  FETCH_START_DATE,
  BASE_EXCHANGE_RATES,
  BENCHMARKS,
  SA20_STOCKS,
} from '@/lib/index-config';
import { calcILSReturn } from '@/lib/ils-return';

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

// ── Yahoo Finance fetcher (LIVE data only) ──
async function yahooDaily(
  ticker: string,
  fromDate: Date
): Promise<{ dates: string[]; prices: number[] } | null> {
  try {
    const p1 = Math.floor(fromDate.getTime() / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?period1=${p1}&period2=${p2}&interval=1d&includeAdjustedClose=true`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.log(`[YAHOO] ${ticker} HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      console.log(`[YAHOO] ${ticker} no chart result`);
      return null;
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    const closes: number[] = quote?.close || [];
    if (!timestamps.length || !closes.length) {
      console.log(`[YAHOO] ${ticker} empty timestamps/closes`);
      return null;
    }

    const dates = timestamps.map(
      (t: number) => new Date(t * 1000).toISOString().split('T')[0]
    );
    console.log(`[YAHOO] ${ticker} OK: ${dates.length} data points, first=${dates[0]} last=${dates[dates.length - 1]}`);
    return { dates, prices: closes };
  } catch (e) {
    console.log(`[YAHOO] ${ticker} EXCEPTION: ${e}`);
    return null;
  }
}

// ── Robust FX fetcher: try multiple tickers ──
async function fetchFxData(fromDate: Date): Promise<{ dates: string[]; prices: number[] } | null> {
  // Try USDILS=X first (explicit pair name), then ILS=X (short form)
  const tickers = ['USDILS=X', 'ILS=X'];
  for (const ticker of tickers) {
    const result = await yahooDaily(ticker, fromDate);
    if (result && result.dates.length > 0) {
      console.log(`[FX] Using ticker ${ticker} with ${result.dates.length} data points`);
      return result;
    }
    console.log(`[FX] Ticker ${ticker} failed or returned empty`);
  }
  console.log('[FX] ALL FX tickers failed — no live FX data available');
  return null;
}

// ── Helper: find nearest FX rate from a map ──
function createFxLookup(fxMap: Map<string, number>) {
  return function getFx(date: string): number | null {
    const exact = fxMap.get(date);
    if (exact) return exact;
    const d = new Date(date);
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() - 1);
      const r = fxMap.get(d.toISOString().split('T')[0]);
      if (r) return r;
    }
    return null;
  };
}

// ══════════════════════════════════════════════
// ── GET handler ──
// Static base data: imported from index-config.ts
// Live data: fetched from Yahoo Finance at runtime
// ══════════════════════════════════════════════

export async function GET(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const periodStart = new Date(FETCH_START_DATE);

    // ── Fetch all LIVE data in parallel ──
    // FX is fetched separately with fallback logic (try USDILS=X then ILS=X)
    const [stockResults, fxResult, ...benchmarkResults] = await Promise.all([
      // SA-20 stocks (live prices)
      Promise.allSettled(
        SA20_STOCKS.map(async (s) => ({
          ticker: s.ticker,
          name: s.name,
          history: await yahooDaily(s.ticker, periodStart),
        }))
      ),
      // USD/ILS exchange rate (live) — tries USDILS=X then ILS=X
      fetchFxData(periodStart),
      // Benchmark indices (live prices)
      ...BENCHMARKS.map(async (b) => ({
        ...b,
        history: await yahooDaily(b.ticker, periodStart),
      })),
    ]);

    // ── Build LIVE FX rate map (date → USD/ILS closing rate) ──
    const fxMap = new Map<string, number>();
    let fxStatus = 'no_data';
    if (fxResult) {
      for (let i = 0; i < fxResult.dates.length; i++) {
        const r = fxResult.prices[i];
        if (r != null && !isNaN(r) && r > 0)
          fxMap.set(fxResult.dates[i], r);
      }
      fxStatus = fxMap.size > 0 ? 'ok' : 'all_null_prices';
    }
    const getFx = createFxLookup(fxMap);

    // ── FX diagnostics (Vercel Function Logs) ──
    console.log(`[FX-MAP] status=${fxStatus} size=${fxMap.size}`);
    if (fxMap.size > 0) {
      const entries = Array.from(fxMap.entries()).sort();
      console.log(`[FX-MAP] first: ${entries[0][0]}=${entries[0][1]}`);
      console.log(`[FX-MAP] last: ${entries[entries.length - 1][0]}=${entries[entries.length - 1][1]}`);
    }

    // ── Dynamic base FX: from Yahoo data near launch date, fallback to config ──
    const dynamicBaseFx = getFx(SA20_LAUNCH_DATE) || BASE_EXCHANGE_RATES.USD_ILS;
    const fxSource = getFx(SA20_LAUNCH_DATE) ? 'yahoo_dynamic' : 'config_fallback';
    console.log(`[FX-BASE] dynamicBaseFx=${dynamicBaseFx} source=${fxSource}`);

    // ── Build per-stock data using STATIC base prices from config ──
    const stockBasePrices = new Map(
      SA20_STOCKS.map((s) => [s.ticker, s])
    );

    const stockMaps = [] as Array<{
      name: string;
      ticker: string;
      priceByDate: Map<string, number>;
      basePrice: number;
      dividends: number;
    }>;

    for (const r of stockResults) {
      if (r.status !== 'fulfilled' || !r.value.history) continue;
      const { ticker, name, history } = r.value;
      const config = stockBasePrices.get(ticker);
      if (!config || config.basePrice <= 0) continue;

      const priceByDate = new Map<string, number>();
      for (let i = 0; i < history.dates.length; i++) {
        const p = history.prices[i];
        if (p != null && !isNaN(p)) priceByDate.set(history.dates[i], p);
      }

      stockMaps.push({
        name,
        ticker,
        priceByDate,
        basePrice: config.basePrice,
        dividends: config.dividends,
      });
    }

    // ── Collect all trading dates ──
    const allDatesSet = new Set<string>();
    for (const sm of stockMaps) {
      for (const d of sm.priceByDate.keys()) allDatesSet.add(d);
    }
    for (const br of benchmarkResults) {
      if (br.history) {
        for (const d of br.history.dates) allDatesSet.add(d);
      }
    }
    const allDates = Array.from(allDatesSet).sort();

    // ══════════════════════════════════════════
    // ── SA-20 Index (equal-weight, base 1000) ──
    // ══════════════════════════════════════════

    const sa20Series: Array<{ date: string; value: number }> = [];
    for (const date of allDates) {
      if (date < SA20_LAUNCH_DATE) continue;

      let totalReturn = 0;
      let count = 0;
      for (const sm of stockMaps) {
        const livePrice = sm.priceByDate.get(date);
        if (livePrice == null || isNaN(livePrice)) continue;
        const stockReturn = (livePrice + sm.dividends) / sm.basePrice - 1;
        totalReturn += stockReturn;
        count++;
      }

      if (count > 0) {
        const avgReturn = totalReturn / count;
        sa20Series.push({
          date,
          value: Math.round(1000 * (1 + avgReturn) * 10) / 10,
        });
      }
    }

    // ══════════════════════════════════════════
    // ── Benchmark indices ──
    // ILS benchmarks: return = (livePrice / staticBasePrice) - 1
    // USD benchmarks: ILS return = (livePrice / staticBasePrice) × (liveFX / baseFX) - 1
    // ══════════════════════════════════════════

    const benchmarkSeries = benchmarkResults.map((br) => {
      if (!br.history)
        return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const { dates, prices } = br.history;
      const needsFx = br.currency === 'USD';

      // Use STATIC base price from config; fall back to Yahoo if config has 0
      let staticBase = br.basePrice;
      if (!staticBase || staticBase <= 0) {
        for (let i = dates.length - 1; i >= 0; i--) {
          if (
            dates[i] < SA20_LAUNCH_DATE &&
            prices[i] != null &&
            !isNaN(prices[i]) &&
            prices[i] > 0
          ) {
            staticBase = prices[i];
            break;
          }
        }
      }
      if (!staticBase || staticBase <= 0)
        return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const data: Array<{ date: string; value: number }> = [];
      let fxHits = 0;
      let fxMisses = 0;

      for (let i = 0; i < dates.length; i++) {
        if (dates[i] < SA20_LAUNCH_DATE) continue;
        const livePrice = prices[i];
        if (livePrice == null || isNaN(livePrice)) continue;

        if (needsFx) {
          const liveFx = getFx(dates[i]);
          if (!liveFx) {
            fxMisses++;
            continue;
          }
          fxHits++;

          const result = calcILSReturn({
            index_t0: staticBase,
            index_t1: livePrice,
            fx_t0: dynamicBaseFx,
            fx_t1: liveFx,
          });
          data.push({ date: dates[i], value: result.ilsIndexValue });
        } else {
          // ILS benchmark — no FX conversion needed
          const ratio = livePrice / staticBase;
          data.push({
            date: dates[i],
            value: Math.round(1000 * ratio * 10) / 10,
          });
        }
      }

      if (needsFx) {
        console.log(`[BENCH] ${br.name}: fxHits=${fxHits} fxMisses=${fxMisses} dataPoints=${data.length}`);
        if (data.length > 0) {
          const last = data[data.length - 1];
          console.log(`[BENCH] ${br.name} last: date=${last.date} ilsValue=${last.value}`);
        }
      }

      return { name: br.name, ticker: br.ticker, color: br.color, data };
    });

    // ══════════════════════════════════════════
    // ── Individual stock performance ──
    // ══════════════════════════════════════════

    const stockPerformance = stockMaps.map((sm) => {
      const sortedEntries = Array.from(sm.priceByDate.entries()).sort(
        (a, b) => b[0].localeCompare(a[0])
      );
      const latestPrice = sortedEntries[0]?.[1] || sm.basePrice;
      const pctChange =
        ((latestPrice + sm.dividends) / sm.basePrice - 1) * 100;

      return {
        name: sm.name,
        ticker: sm.ticker,
        pctChange: Math.round(pctChange * 100) / 100,
        latestPrice,
      };
    });

    // ── Failed tickers ──
    const successTickers = new Set(stockMaps.map((s) => s.ticker));
    const failedTickers = SA20_STOCKS.filter(
      (s) => !successTickers.has(s.ticker)
    ).map((s) => ({ name: s.name, ticker: s.ticker }));

    // ── Benchmark debug info (in API JSON, not in UI) ──
    const benchmarkDebug: Record<string, unknown> = {};
    for (const bs of benchmarkSeries) {
      const lastPoint = bs.data[bs.data.length - 1];
      const cfg = BENCHMARKS.find((b) => b.ticker === bs.ticker);
      benchmarkDebug[bs.name] = {
        dataPoints: bs.data.length,
        lastValue: lastPoint?.value || null,
        lastDate: lastPoint?.date || null,
        staticBasePrice: cfg?.basePrice || 'fallback',
        currency: cfg?.currency || '?',
        fxApplied: cfg?.currency === 'USD',
        dynamicBaseFx: cfg?.currency === 'USD' ? dynamicBaseFx : 'N/A',
        configBaseFx: cfg?.currency === 'USD' ? BASE_EXCHANGE_RATES.USD_ILS : 'N/A',
        liveFxLatest: cfg?.currency === 'USD' ? getFx(allDates[allDates.length - 1]) : 'N/A',
      };
    }

    // ── Response (with cache-busting headers) ──
    const response = NextResponse.json({
      sa20: sa20Series,
      benchmarks: benchmarkSeries,
      stockPerformance,
      stockCount: stockMaps.length,
      totalStocks: SA20_STOCKS.length,
      failedTickers,
      lastUpdated: new Date().toISOString(),
      startDate: FETCH_START_DATE,
      fxRatesCount: fxMap.size,
      fxStatus,
      fxSource,
      liveFxRate: getFx(allDates[allDates.length - 1]),
      dynamicBaseFx,
      configBaseFx: BASE_EXCHANGE_RATES.USD_ILS,
      benchmarkDebug,
      _version: 'fix-fx-dual-ticker-v4',
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
