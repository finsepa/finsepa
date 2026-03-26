export const STOCK_CHART_RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "ALL"] as const;
export type StockChartRange = (typeof STOCK_CHART_RANGES)[number];

export type StockChartPoint = {
  /** UNIX seconds (UTC). Compatible with lightweight-charts UTCTimestamp. */
  time: number;
  value: number;
};

export type StockChartResponse = {
  ticker: string;
  range: StockChartRange;
  points: StockChartPoint[];
};

