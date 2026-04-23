export const STOCK_CHART_RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;
export type StockChartRange = (typeof STOCK_CHART_RANGES)[number];

export const STOCK_CHART_SERIES = ["price", "marketCap", "return"] as const;
export type StockChartSeries = (typeof STOCK_CHART_SERIES)[number];

export function isStockChartSeries(v: string | null | undefined): v is StockChartSeries {
  return v === "price" || v === "marketCap" || v === "return";
}

export type StockChartPoint = {
  /** UNIX seconds (UTC). Compatible with lightweight-charts UTCTimestamp. */
  time: number;
  value: number;
  /**
   * Exchange/session calendar date `YYYY-MM-DD` when known (EODHD `date` for dailies;
   * US/Eastern session date for intraday). Used to align portfolio benchmark paths with
   * ledger dates without UTC midnight rounding drift.
   */
  sessionDate?: string;
  /** When API provides an IANA zone, used for price timestamp display. */
  timeZone?: string;
};

export type StockChartResponse = {
  ticker: string;
  range: StockChartRange;
  series?: StockChartSeries;
  points: StockChartPoint[];
};

