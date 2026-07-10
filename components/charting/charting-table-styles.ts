export const CHARTING_TABLE_FIRST_COL_ALL_CLASS = "min-w-[11rem]";
export const CHARTING_TABLE_FIRST_COL_CAPPED_CLASS = "w-[12.5rem] min-w-[12.5rem] max-w-[12.5rem]";

export const CHARTING_TABLE_STICKY_FIRST_COL_BODY_CLASS =
  "sticky left-0 z-[1] bg-white shadow-[1px_0_0_0_#E4E4E7]";

export const CHARTING_TABLE_STICKY_FIRST_COL_HEAD_CLASS =
  "sticky left-0 z-[2] bg-white shadow-[1px_0_0_0_#E4E4E7]";

export type ChartingTableTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";

export function chartingTableFirstColClass(timeRange?: ChartingTableTimeRange): string {
  return timeRange === "all" ? CHARTING_TABLE_FIRST_COL_ALL_CLASS : CHARTING_TABLE_FIRST_COL_CAPPED_CLASS;
}
