import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadTickerData() {
  const filePath = join(process.cwd(), 'public', 'data', 'stock-tickers.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// Cache the result for 4 hours (Vercel edge cache)
export const revalidate = 14400;

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

/* Benchmark indices */
const BENCHMARKS = [
  { name: 'ת"א 125', ticker: 'TA125.TA', color: '#60a5fa' },
  { name: 'S&P 500', ticker: '^GSPC', color: '#f59e0b' },
  { name: 'NASDAQ', ticker: '^IXIC', color: '#a78bfa' },
  { name: 'MSCI World', ticker: 'URTH', color: '#f472b6' },
];

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case '1w':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '1m':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '1y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'ytd':
    default:
      return new Date('2026-01-01');
  }
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
      next: { revalidate: 14400 },
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
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'ytd';
    const periodStart = getPeriodStart(period);

    const tickerData = loadTickerData();
    const stocks = tickerData.stocks;

    // Fetch all stock histories + benchmarks in parallel
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
        return { name: b.name, ticker: b.ticker, color: b.color, history };
      }),
    ]);

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
        sa20Series.push({ date, value: Math.round((totalPctChange / count) * 100) / 100 });
      }
    }

    // ── Benchmark series ──
    const benchmarkSeries = benchmarkResults.map((br) => {
      if (!br.history) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };
      const basePrice = br.history.prices.find((p: number) => p != null && !isNaN(p) && p > 0);
      if (!basePrice) return { name: br.name, ticker: br.ticker, color: br.color, data: [] };

      const data: Array<{ date: string; value: number }> = [];
      for (let i = 0; i < br.history.dates.length; i++) {
        const p = br.history.prices[i];
        if (p != null && !isNaN(p)) {
          data.push({
            date: br.history.dates[i],
            value: Math.round(((p - basePrice) / basePrice) * 10000) / 100,
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
      })
      .sort((a, b) => b.pctChange - a.pctChange);

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
      period,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
