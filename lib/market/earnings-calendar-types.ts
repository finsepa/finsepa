/** Report timing from provider (normalized for UI). */
export type EarningsReportTiming = "bmo" | "amc" | "unknown";

export type EarningsCalendarItem = {
  ticker: string;
  /** Display name; falls back to ticker if unavailable. */
  companyName: string;
  logoUrl: string;
  /** 1-based rank on Screener (curated top 10, then next names by market cap). */
  screenerRank: number | null;
  reportDate: string;
  timing: EarningsReportTiming;
  timingLabel: string;
};

export type EarningsDayColumn = {
  /** YYYY-MM-DD (UTC calendar date) */
  date: string;
  weekdayLabel: string;
  dayNumber: string;
  items: EarningsCalendarItem[];
};

export type EarningsDatasetFilter = "universe_mc" | "fundamentals_mc";

export type EarningsWeekPayload = {
  weekMondayYmd: string;
  weekLabel: string;
  days: EarningsDayColumn[];
  hasAnyEvents: boolean;
  /** Internal: how rows were filtered (not shown in UI). */
  datasetFilter: EarningsDatasetFilter;
};
