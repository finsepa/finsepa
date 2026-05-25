import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  formatChartingPeriodLabel,
  formatFinancialsPeriodEndDisplay,
} from "@/lib/market/charting-period-display";

export function ymdYearLabel(periodEnd: string): string {
  const s = periodEnd.trim();
  if (/^\d{4}/.test(s)) return s.slice(0, 4);
  const d = Date.parse(s.includes("T") ? s : `${s}T12:00:00.000Z`);
  if (!Number.isFinite(d)) return s.slice(0, 10);
  return String(new Date(d).getUTCFullYear());
}

export function annualFundamentalsSlice(
  points: ChartingSeriesPoint[],
  periodMode: FundamentalsSeriesMode = "annual",
): {
  columns: string[];
  /** Period-ending labels aligned with `columns` (e.g. `Dec 31, 2021`). */
  columnPeriodEnds: string[];
  slice: ChartingSeriesPoint[];
} | null {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const slice = sorted;
  const columns = slice.map((p) =>
    periodMode === "quarterly"
      ? formatChartingPeriodLabel(p.periodEnd, "quarterly")
      : ymdYearLabel(p.periodEnd),
  );
  const columnPeriodEnds = slice.map((p) => formatFinancialsPeriodEndDisplay(p.periodEnd));
  return { columns, columnPeriodEnds, slice };
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const a = Math.abs(prev);
  if (a < 1e-9) return null;
  return ((cur - prev) / a) * 100;
}

type FinancialsTableRowLike = {
  values: readonly (number | null)[];
  format?: string;
};

/** True when a row has at least one value we should show (not null, and not a USD zero placeholder). */
export function financialsRowHasNumericValues(
  values: readonly (number | null)[],
  format?: string,
): boolean {
  return values.some((v) => {
    if (v == null || !Number.isFinite(v)) return false;
    if ((format === "usd" || format === "perShare") && Math.abs(v) < 1e-9) return false;
    return true;
  });
}

/** Drop rows that are all dashes (no annual or TTM figures). */
export function filterFinancialsTableEmptyRows<T extends { rows: ReadonlyArray<FinancialsTableRowLike> }>(
  model: T,
): T {
  return {
    ...model,
    rows: model.rows.filter((r) => financialsRowHasNumericValues(r.values, r.format)),
  };
}
