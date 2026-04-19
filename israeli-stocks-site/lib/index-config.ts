/**
 * SA-20 Index Configuration
 *
 * Static historical parameters that are CONSTANT for this index.
 * These values come directly from Shlomi's master spreadsheet
 * and must NEVER be dynamically fetched or calculated.
 *
 * LIVE data (current prices, current FX rate) is fetched separately
 * by the API route at runtime.
 */

// ── Launch date ──

/** The date the SA-20 index was launched */
export const SA20_LAUNCH_DATE = '2026-04-06';

/** Earliest date to fetch from Yahoo (need pre-launch data for US markets) */
export const FETCH_START_DATE = '2026-04-02';

// ── Base exchange rates (static, from Shlomi's spreadsheet) ──

export const BASE_EXCHANGE_RATES = {
  /** USD/ILS rate on the SA-20 launch date (06/04/2026) */
  USD_ILS: 3.130375,
  /** GBP/ILS rate on the SA-20 launch date */
  GBP_ILS: 4.133142,
  /** EUR/ILS rate on the SA-20 launch date */
  EUR_ILS: 3.606595,
} as const;

// ── Benchmark indices ──

export interface BenchmarkConfig {
  name: string;
  ticker: string;
  color: string;
  currency: 'ILS' | 'USD';
  /** Static base price from Shlomi's spreadsheet (שער השקת מדד 06/04/26) */
  basePrice: number;
}

export const BENCHMARKS: BenchmarkConfig[] = [
  { name: 'ת"א 125',   ticker: '^TA125.TA', color: '#60a5fa', currency: 'ILS', basePrice: 4107.92 },
  { name: 'S&P 500',    ticker: '^GSPC',     color: '#f59e0b', currency: 'USD', basePrice: 6582.69 },
  { name: 'Nasdaq 100', ticker: '^NDX',      color: '#a78bfa', currency: 'USD', basePrice: 0 },
  { name: 'MSCI World', ticker: 'URTH',      color: '#f472b6', currency: 'USD', basePrice: 0 },
];

// ── SA-20 stocks ──

export interface StockConfig {
  name: string;
  ticker: string;
  taseId: number;
  /** Static base price from Shlomi's spreadsheet (שער השקת מדד 06/04/26) */
  basePrice: number;
  /** Cumulative dividends paid since launch (in agorot, same unit as price) */
  dividends: number;
}

/**
 * All 20 stocks in the SA-20 index with their STATIC base prices.
 * Base prices are from Shlomi's spreadsheet column E: "שער השקת מדד 06/04/26"
 *
 * To update: only change `dividends` when a stock pays out.
 * `basePrice` should NEVER change — it's a historical fact.
 */
export const SA20_STOCKS: StockConfig[] = [
  { name: 'אב-גד',              ticker: 'AVGD.TA', taseId: 1829, basePrice: 1319,   dividends: 0 },
  { name: 'אי.בי.אי בית השקעות', ticker: 'IBI.TA',  taseId: 175,  basePrice: 33100,  dividends: 0 },
  { name: 'אקסל סולושנס',        ticker: 'ACCL.TA', taseId: 770,  basePrice: 176.5,  dividends: 0 },
  { name: 'ארי נדל"ן',           ticker: 'ARIN.TA', taseId: 366,  basePrice: 520,    dividends: 0 },
  { name: 'גאון קבוצה',          ticker: 'GAGR.TA', taseId: 454,  basePrice: 1097,   dividends: 0 },
  { name: 'גילת טלקום',          ticker: 'GLTL.TA', taseId: 1006, basePrice: 187.9,  dividends: 0 },
  { name: 'הייפר גלובל',         ticker: 'HIPR.TA', taseId: 2369, basePrice: 2550,   dividends: 0 },
  { name: 'טלסיס',              ticker: 'TLSY.TA', taseId: 354,  basePrice: 27220,  dividends: 0 },
  { name: 'טרמינל איקס',         ticker: 'TRX.TA',  taseId: 1948, basePrice: 707.5,  dividends: 0 },
  { name: 'מבטח שמיר',           ticker: 'MISH.TA', taseId: 127,  basePrice: 38350,  dividends: 0 },
  { name: 'מיטב בית השקעות',      ticker: 'MTAV.TA', taseId: 1064, basePrice: 11100,  dividends: 0 },
  { name: 'מלם תים',             ticker: 'MLTM.TA', taseId: 156,  basePrice: 8399,   dividends: 0 },
  { name: 'מניף',                ticker: 'MNIF.TA', taseId: 1828, basePrice: 2518,   dividends: 0 },
  { name: 'מר תעשיות',           ticker: 'CMER.TA', taseId: 338,  basePrice: 4411,   dividends: 0 },
  { name: 'נאוויטס פטרוליום',     ticker: 'NVPT.TA', taseId: 1688, basePrice: 13000,  dividends: 0 },
  { name: 'נקסטקום',             ticker: 'NXTM.TA', taseId: 1298, basePrice: 812.1,  dividends: 0 },
  { name: 'סופוויב',             ticker: 'SOFW.TA', taseId: 1886, basePrice: 3837,   dividends: 0 },
  { name: 'פוקס',                ticker: 'FOX.TA',  taseId: 1140, basePrice: 27220,  dividends: 0 },
  { name: 'קווליטאו',            ticker: 'QLTU.TA', taseId: 1093, basePrice: 57800,  dividends: 0 },
  { name: 'שוהם ביזנס',          ticker: 'SHOM.TA', taseId: 1071, basePrice: 788.8,  dividends: 13.20 },
];
