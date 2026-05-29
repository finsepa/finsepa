import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import type { StockAnnualReturn } from "@/lib/market/stock-performance-types";

/** Comparison return chart — calendar years on the x-axis (oldest left, current year right). */
export const COMPARISON_ANNUAL_RETURN_YEARS = 10;

function pickBarOnOrAfter(bars: EodhdDailyBar[], ymdStart: string): EodhdDailyBar | null {
  for (const b of bars) {
    if (b.date >= ymdStart) return b;
  }
  return null;
}

function pctChange(current: number | null, base: number | null): number | null {
  if (current == null || base == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return ((current - base) / base) * 100;
}

function lastBarInYear(bars: EodhdDailyBar[], year: number): EodhdDailyBar | null {
  let last: EodhdDailyBar | null = null;
  for (const b of bars) {
    const y = Number(b.date.slice(0, 4));
    if (!Number.isFinite(y) || y < year) continue;
    if (y > year) break;
    last = b;
  }
  return last;
}

function barClose(bar: EodhdDailyBar | null): number | null {
  if (!bar || typeof bar.close !== "number" || !Number.isFinite(bar.close)) return null;
  return bar.close;
}

function calendarYearReturnPct(sorted: EodhdDailyBar[], year: number, currentYear: number): number | null {
  const endClose = barClose(lastBarInYear(sorted, year));
  if (endClose == null) return null;

  if (year === currentYear) {
    return pctChange(endClose, barClose(pickBarOnOrAfter(sorted, `${year}-01-01`)));
  }

  const priorYearEnd = barClose(lastBarInYear(sorted, year - 1));
  if (priorYearEnd != null) {
    return pctChange(endClose, priorYearEnd);
  }

  // History starts during `year` (no prior Dec): Jan 1 → year-end close.
  return pctChange(endClose, barClose(pickBarOnOrAfter(sorted, `${year}-01-01`)));
}

/** Inclusive UTC year range for the comparison chart (e.g. 2017 … 2026). */
export function comparisonAnnualReturnYears(now: Date = new Date()): number[] {
  const end = now.getUTCFullYear();
  const start = end - COMPARISON_ANNUAL_RETURN_YEARS + 1;
  const years: number[] = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

export function emptyAnnualReturns(now: Date = new Date()): StockAnnualReturn[] {
  return comparisonAnnualReturnYears(now).map((year) => ({ year, returnPct: null }));
}

/**
 * Calendar-year return per bar. Current year uses YTD (first session on/after Jan 1 → latest close).
 * Prior years use prior calendar year-end close → year-end close.
 */
export function computeAnnualReturnsFromSortedDailyBars(
  sortedInput: EodhdDailyBar[],
  now: Date = new Date(),
  yearCount = COMPARISON_ANNUAL_RETURN_YEARS,
): StockAnnualReturn[] {
  const sorted = sortedInput.length ? [...sortedInput].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - yearCount + 1;
  const out: StockAnnualReturn[] = [];

  for (let year = startYear; year <= currentYear; year++) {
    out.push({ year, returnPct: calendarYearReturnPct(sorted, year, currentYear) });
  }

  return out;
}

export function annualReturnPctForYear(
  perf: { annualReturns?: StockAnnualReturn[] } | null | undefined,
  year: number,
): number | null {
  const row = perf?.annualReturns?.find((r) => r.year === year);
  return row?.returnPct != null && Number.isFinite(row.returnPct) ? row.returnPct : null;
}
