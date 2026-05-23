import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";

/** Max fiscal history shown in Key Stats, charting fundamentals, and related series (20 years). */
export const FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS = 20;

/** 20 years × 4 quarters per year. */
export const FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS =
  FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS * 4;

export function maxFundamentalsHistoryPeriods(mode: FundamentalsSeriesMode): number {
  return mode === "quarterly"
    ? FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS
    : FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS;
}

/** Keep the newest `periodEnd` rows (series is oldest → newest). */
export function limitFundamentalsHistoryPoints(
  points: ChartingSeriesPoint[],
  mode: FundamentalsSeriesMode,
): ChartingSeriesPoint[] {
  const max = maxFundamentalsHistoryPeriods(mode);
  return points.length > max ? points.slice(-max) : points;
}
