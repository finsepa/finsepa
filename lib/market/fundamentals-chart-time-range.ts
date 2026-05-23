import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
  FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
} from "@/lib/market/fundamentals-history-limit";

export type FundamentalsChartTimeRange = "5Y" | "10Y" | "all";

export const FUNDAMENTALS_CHART_TIME_RANGE_ORDER: FundamentalsChartTimeRange[] = [
  "5Y",
  "10Y",
  "all",
];

export const FUNDAMENTALS_CHART_TIME_RANGE_LABELS: Record<FundamentalsChartTimeRange, string> = {
  "5Y": "5Y",
  "10Y": "10Y",
  all: "All",
};

const RANGE_PERIODS: Record<FundamentalsChartTimeRange, { annual: number; quarterly: number }> = {
  "5Y": { annual: 5, quarterly: 20 },
  "10Y": { annual: 10, quarterly: 40 },
  all: {
    annual: FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
    quarterly: FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
  },
};

export function applyFundamentalsChartTimeRange(
  points: ChartingSeriesPoint[],
  periodMode: FundamentalsSeriesMode,
  range: FundamentalsChartTimeRange,
): ChartingSeriesPoint[] {
  if (points.length === 0) return points;
  if (range === "all") return points;
  const max = RANGE_PERIODS[range][periodMode];
  if (!Number.isFinite(max)) return points;
  return points.slice(-max);
}

export function maxPeriodsForFundamentalsChartTimeRange(
  periodMode: FundamentalsSeriesMode,
  range: FundamentalsChartTimeRange,
): number {
  return RANGE_PERIODS[range][periodMode];
}
