export const PORTFOLIO_CHART_RANGES = ["1d", "7d", "1m", "6m", "ytd", "1y", "5y", "all"] as const;
export type PortfolioChartRange = (typeof PORTFOLIO_CHART_RANGES)[number];

export type PortfolioValueHistoryPoint = {
  /** yyyy-MM-dd */
  t: string;
  /** Equity at mark + cash (net worth). */
  value: number;
  /**
   * Realized + unrealized equity P/L through this date (`profit` in value-history server),
   * i.e. same components as {@link lifetimeEquityProfitUsd} at “now”, evaluated as-of `t`.
   */
  profit: number;
  /**
   * Lifetime-style equity return % through this date: `profit` divided by total historical
   * equity cost basis as of `t` (open basis + cost of sold shares). Matches overview
   * “Total profit” ATH % at the last point when marks match current holdings.
   */
  returnPct: number | null;
};
