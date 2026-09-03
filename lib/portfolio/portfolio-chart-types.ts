export const PORTFOLIO_CHART_RANGES = ["1d", "5d", "1m", "6m", "ytd", "1y", "5y", "all"] as const;
export type PortfolioChartRange = (typeof PORTFOLIO_CHART_RANGES)[number];

export type PortfolioValueHistoryPoint = {
  /** US session / valuation date (yyyy-MM-dd). */
  t: string;
  /** UNIX seconds for intraday YTD samples (two per session day); chart x when set. */
  time?: number;
  /** Equity at mark + cash (net worth). */
  value: number;
  /**
   * Total profit $ through `t` for the **selected chart range window**:
   * - Period ranges (6M, 1Y, …): Modified Dietz gain over that window
   *   (`vEnd − vStart − external net flows`) — same $ as Overview Total profit cards.
   * - `all` (or windows that start before inception): realized + unrealized equity P/L
   *   as-of `t` (lifetime / inception path).
   */
  profit: number;
  /**
   * Modified Dietz return % through `t` for the **selected chart range window**
   * (same period keys as Overview Total profit / Allocation center).
   * For `all` (or windows that start before inception), this is inception Dietz.
   */
  returnPct: number | null;
};
