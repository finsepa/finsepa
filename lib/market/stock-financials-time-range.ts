import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
  FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
} from "@/lib/market/fundamentals-history-limit";

/** Financials table year/quarter window (ALL capped at 20 fiscal years). */
export type FinancialsTableTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";

export const FINANCIALS_TABLE_TIME_RANGE_ORDER: FinancialsTableTimeRange[] = [
  "1Y",
  "2Y",
  "3Y",
  "5Y",
  "10Y",
  "all",
];

export const FINANCIALS_TABLE_TIME_RANGE_LABELS: Record<FinancialsTableTimeRange, string> = {
  "1Y": "1Y",
  "2Y": "2Y",
  "3Y": "3Y",
  "5Y": "5Y",
  "10Y": "10Y",
  all: "All",
};

const RANGE_PERIODS: Record<FinancialsTableTimeRange, { annual: number; quarterly: number }> = {
  "1Y": { annual: 1, quarterly: 4 },
  "2Y": { annual: 2, quarterly: 8 },
  "3Y": { annual: 3, quarterly: 12 },
  "5Y": { annual: 5, quarterly: 20 },
  "10Y": { annual: 10, quarterly: 40 },
  all: {
    annual: FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
    quarterly: FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
  },
};

export function maxPeriodsForFinancialsTableTimeRange(
  periodMode: FundamentalsSeriesMode,
  range: FinancialsTableTimeRange,
): number {
  return RANGE_PERIODS[range][periodMode];
}

/** Latest N fiscal years or quarters (ALL = up to 20 years / 80 quarters). */
export function applyFinancialsTableTimeRange(
  points: ChartingSeriesPoint[],
  periodMode: FundamentalsSeriesMode,
  range: FinancialsTableTimeRange,
): ChartingSeriesPoint[] {
  if (points.length === 0) return points;
  const max = maxPeriodsForFinancialsTableTimeRange(periodMode, range);
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  return sorted.slice(-max);
}
