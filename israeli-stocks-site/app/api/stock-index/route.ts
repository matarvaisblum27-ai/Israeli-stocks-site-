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

async function fetchStockHistory(ticker: string): Promise<{ dates: string[]; prices: number[] } | null> {
  try {
    // Yahoo Finance chart API - get data from Jan 1 2026 to now
    const period1 = Math.floor(new Date('2026-01-01').getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 14400 }, // cache 4 hours
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

export async function GET() {
  try {
    const tickerData = loadTickerData();
    const stocks = tickerData.stocks;

    // Fetch all stock histories in parallel
    const results = await Promise.allSettled(
      stocks.map(async (stock) => {
        const history = await fetchStockHistory(stock.ticker);
        return { name: stock.name, ticker: stock.ticker, history };
      })
    );

    // Collect all unique dates
    const allDatesSet = new Set<string>();
    const stockHistories: Array<{ name: string; ticker: string; dates: string[]; prices: number[] }> = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.history) {
        const { name, ticker, history } = result.value;
        stockHistories.push({ name, ticker, dates: history.dates, prices: history.prices });
        history.dates.forEach((d: string) => allDatesSet.add(d));
      }
    }

    const allDates = Array.from(allDatesSet).sort();

    if (allDates.length === 0 || stockHistories.length === 0) {
      return NextResponse.json({
        error: 'No data available',
        stockCount: 0,
        failedTickers: stocks.map(s => s.ticker)
      }, { status: 200 });
    }

    // For each stock, calculate % change from its first available price
    // Then for each date, compute the average % change across all stocks
    const indexData: Array<{ date: string; value: number; count: number }> = [];

    // Create lookup maps for each stock: date -> price
    const stockMaps = stockHistories.map((sh) => {
      const map = new Map<string, number>();
      for (let i = 0; i < sh.dates.length; i++) {
        if (sh.prices[i] != null && !isNaN(sh.prices[i])) {
          map.set(sh.dates[i], sh.prices[i]);
        }
      }
      const basePrice = sh.prices.find((p: number) => p != null && !isNaN(p) && p > 0);
      return { name: sh.name, ticker: sh.ticker, map, basePrice: basePrice || 0 };
    });

    for (const date of allDates) {
      let totalPctChange = 0;
      let count = 0;

      for (const sm of stockMaps) {
        if (sm.basePrice <= 0) continue;
        const price = sm.map.get(date);
        if (price != null && !isNaN(price)) {
          const pctChange = ((price - sm.basePrice) / sm.basePrice) * 100;
          totalPctChange += pctChange;
          count++;
        }
      }

      if (count > 0) {
        indexData.push({
          date,
          value: Math.round((totalPctChange / count) * 100) / 100,
          count,
        });
      }
    }

    // Individual stock performance (latest vs base)
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
      .filter((s) => !successTickers.includes(s.ticker))
      .map((s) => ({ name: s.name, ticker: s.ticker }));

    return NextResponse.json({
      indexData,
      stockPerformance,
      stockCount: stockHistories.length,
      totalStocks: stocks.length,
      failedTickers,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: String(error) },
      { status: 500 }
    );
  }
}
