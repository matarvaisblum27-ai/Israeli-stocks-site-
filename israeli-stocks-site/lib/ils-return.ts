/**
 * ILS Return Calculator for Foreign Indices
 *
 * Calculates the total return of a USD-denominated index converted to Israeli Shekels.
 *
 * Formula:
 *   Total Return (ILS) = ((Index_t1 / Index_t0) * (FX_t1 / FX_t0)) - 1
 *
 * Where:
 *   Index_t0 = Index closing price on the START date
 *   Index_t1 = Index closing price on the END date
 *   FX_t0    = USD/ILS exchange rate on the EXACT SAME START date
 *   FX_t1    = USD/ILS exchange rate on the EXACT SAME END date
 *
 * All 4 data points must be date-paired: index and FX use the SAME t0, SAME t1.
 */

// ── Types ──

interface DailyRecord {
  date: string;   // "YYYY-MM-DD"
  close: number;  // closing price
}

interface ILSReturnInput {
  index_t0: number; // Index price at start
  index_t1: number; // Index price at end
  fx_t0: number;    // USD/ILS rate at start (SAME date as index_t0)
  fx_t1: number;    // USD/ILS rate at end   (SAME date as index_t1)
}

interface ILSReturnResult {
  indexReturnPct: number;  // Pure USD index return (%)
  fxChangePct: number;     // USD/ILS change (%)  — negative = shekel strengthened
  ilsReturnPct: number;    // Combined ILS return (%)
  ilsIndexValue: number;   // Value on base-1000 scale
  inputs: ILSReturnInput;  // Echo back the 4 inputs for verification
}

// ── Core calculation (pure math, no fetching) ──

export function calcILSReturn(input: ILSReturnInput): ILSReturnResult {
  const { index_t0, index_t1, fx_t0, fx_t1 } = input;

  if (index_t0 <= 0 || fx_t0 <= 0) {
    throw new Error(`Invalid base values: index_t0=${index_t0}, fx_t0=${fx_t0}`);
  }

  const indexRatio = index_t1 / index_t0;     // e.g. 1.05 = index up 5%
  const fxRatio = fx_t1 / fx_t0;              // e.g. 0.94 = shekel strengthened 6%
  const ilsRatio = indexRatio * fxRatio;       // combined ratio

  const indexReturnPct = (indexRatio - 1) * 100;
  const fxChangePct = (fxRatio - 1) * 100;
  const ilsReturnPct = (ilsRatio - 1) * 100;
  const ilsIndexValue = 1000 * ilsRatio;       // base-1000 scale

  return {
    indexReturnPct: Math.round(indexReturnPct * 100) / 100,
    fxChangePct: Math.round(fxChangePct * 100) / 100,
    ilsReturnPct: Math.round(ilsReturnPct * 100) / 100,
    ilsIndexValue: Math.round(ilsIndexValue * 10) / 10,
    inputs: input,
  };
}

// ── Date-paired lookup ──

/**
 * Given a target date and a sorted array of daily records,
 * find the record ON or closest BEFORE that date.
 * Returns null if no record exists at or before the target.
 */
export function findClosestRecord(
  targetDate: string,
  records: DailyRecord[]
): DailyRecord | null {
  let best: DailyRecord | null = null;
  for (const r of records) {
    if (r.date <= targetDate && r.close > 0 && !isNaN(r.close)) {
      best = r; // records are sorted ascending, so last match wins
    }
    if (r.date > targetDate) break;
  }
  return best;
}

/**
 * Build date-paired ILS return inputs from raw time series.
 *
 * Ensures that t0 uses the SAME date for both index and FX,
 * and t1 uses the SAME date for both index and FX.
 *
 * Strategy for t0:
 *   1. Find the last index close ON or BEFORE the start date
 *   2. Find the FX close on that EXACT same date
 *   3. If no FX on that exact date, walk backwards up to 7 days
 *
 * Strategy for t1:
 *   Same logic but for the end date.
 */
export function buildILSReturnInputs(
  startDate: string,
  endDate: string,
  indexRecords: DailyRecord[],
  fxRecords: DailyRecord[]
): { input: ILSReturnInput; t0Date: string; t1Date: string } | null {
  // Sort ascending by date
  const sortedIndex = [...indexRecords].sort((a, b) => a.date.localeCompare(b.date));
  const sortedFx = [...fxRecords].sort((a, b) => a.date.localeCompare(b.date));

  // Build FX lookup map for fast exact-date access
  const fxByDate = new Map<string, number>();
  for (const r of sortedFx) {
    if (r.close > 0 && !isNaN(r.close)) fxByDate.set(r.date, r.close);
  }

  // Helper: get FX for exact date, or walk back up to 7 days
  function getFxForDate(date: string): { rate: number; actualDate: string } | null {
    const exact = fxByDate.get(date);
    if (exact) return { rate: exact, actualDate: date };
    const d = new Date(date);
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() - 1);
      const key = d.toISOString().split('T')[0];
      const r = fxByDate.get(key);
      if (r) return { rate: r, actualDate: key };
    }
    return null;
  }

  // ── t0: find index base, then match FX to same date ──
  const indexAtT0 = findClosestRecord(startDate, sortedIndex);
  if (!indexAtT0) return null;

  const fxAtT0 = getFxForDate(indexAtT0.date);
  if (!fxAtT0) return null;

  // ── t1: find index end, then match FX to same date ──
  const indexAtT1 = findClosestRecord(endDate, sortedIndex);
  if (!indexAtT1) return null;

  const fxAtT1 = getFxForDate(indexAtT1.date);
  if (!fxAtT1) return null;

  return {
    input: {
      index_t0: indexAtT0.close,
      index_t1: indexAtT1.close,
      fx_t0: fxAtT0.rate,
      fx_t1: fxAtT1.rate,
    },
    t0Date: indexAtT0.date,
    t1Date: indexAtT1.date,
  };
}

/**
 * Compute ILS return for every date in a time series.
 *
 * For each date d after startDate:
 *   t0 = base date (last trading day on or before startDate)
 *   t1 = d
 *   All 4 data points are date-paired.
 *
 * Returns an array of { date, value } where value is on a base-1000 scale.
 */
export function computeILSTimeSeries(
  startDate: string,
  indexRecords: DailyRecord[],
  fxRecords: DailyRecord[],
  fallbackBaseFx?: number
): Array<{ date: string; value: number }> {
  const sortedIndex = [...indexRecords].sort((a, b) => a.date.localeCompare(b.date));
  const sortedFx = [...fxRecords].sort((a, b) => a.date.localeCompare(b.date));

  // FX lookup map
  const fxByDate = new Map<string, number>();
  for (const r of sortedFx) {
    if (r.close > 0 && !isNaN(r.close)) fxByDate.set(r.date, r.close);
  }

  function getFxForDate(date: string): number | null {
    const exact = fxByDate.get(date);
    if (exact) return exact;
    const d = new Date(date);
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() - 1);
      const key = d.toISOString().split('T')[0];
      const r = fxByDate.get(key);
      if (r) return r;
    }
    return null;
  }

  // Find t0: last index close on or before startDate
  const baseRecord = findClosestRecord(startDate, sortedIndex);
  if (!baseRecord) return [];

  const baseFx = getFxForDate(baseRecord.date) || fallbackBaseFx;
  if (!baseFx) return [];

  const series: Array<{ date: string; value: number }> = [];

  for (const rec of sortedIndex) {
    if (rec.date < startDate) continue;
    if (rec.close <= 0 || isNaN(rec.close)) continue;

    const todayFx = getFxForDate(rec.date);
    if (!todayFx) continue;

    // The formula: (Index_t1 / Index_t0) * (FX_t1 / FX_t0)
    const indexRatio = rec.close / baseRecord.close;
    const fxRatio = todayFx / baseFx;
    const ilsRatio = indexRatio * fxRatio;

    series.push({
      date: rec.date,
      value: Math.round(1000 * ilsRatio * 10) / 10,
    });
  }

  return series;
}
