export const PORTFOLIO_CHART_RANGES = ["1d", "7d", "1m", "6m", "ytd", "1y", "5y", "all"] as const;
export type PortfolioChartRange = (typeof PORTFOLIO_CHART_RANGES)[number];

export type PortfolioValueHistoryPoint = {
  /** yyyy-MM-dd */
  t: string;
  /** Equity at mark + cash (net worth). */
  value: number;
  /** Unrealized P/L on open positions at this date (equity − cost basis). */
  profit: number;
};
