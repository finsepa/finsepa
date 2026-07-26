/** Period column width — capped for sparse ranges so the Year col does not dominate. */
export const CHARTING_TABLE_FIRST_COL_ALL_CLASS = "min-w-[11rem]";
export const CHARTING_TABLE_FIRST_COL_CAPPED_CLASS = "w-[12.5rem] min-w-[12.5rem] max-w-[12.5rem]";

export type ChartingTableTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";

export function chartingTableFirstColClass(timeRange?: ChartingTableTimeRange): string {
  return timeRange === "all" ? CHARTING_TABLE_FIRST_COL_ALL_CLASS : CHARTING_TABLE_FIRST_COL_CAPPED_CLASS;
}
