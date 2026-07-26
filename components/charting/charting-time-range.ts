/**
 * Charting period / time-range constants — kept out of `charting-workspace.tsx`
 * so empty toolbar / light UI can import without pulling lightweight-charts.
 */

export type ChartTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";
export type ChartType = "line" | "bars";

/** Default period when opening Charting (stock tab, compare, empty toolbar). */
export const DEFAULT_CHART_TIME_RANGE: ChartTimeRange = "10Y";

/** Stock page Charting tab — 3Y through All (no 1Y/2Y). */
export const DEFAULT_CHART_TIME_RANGE_ORDER: ChartTimeRange[] = ["3Y", "5Y", "10Y", "all"];

/** Standalone `/charting` page only (not symbol tab). */
export const STANDALONE_CHARTING_TIME_RANGE_ORDER: ChartTimeRange[] = ["3Y", "5Y", "10Y", "all"];
