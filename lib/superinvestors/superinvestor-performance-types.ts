/** Hypothetical starting capital for $ profit series (both book and S&P). */
export const SUPERINVESTOR_PERF_NOTIONAL_USD = 10_000;

/**
 * Managers with Performance tab + durable series rebuild.
 * Add a slug here after wiring CIK + cron rebuild (see SUPERINVESTORS-PERFORMANCE.md §9).
 */
export const SUPERINVESTOR_PERFORMANCE_ENABLED_SLUGS = [
  "berkshire-hathaway",
  "bill-ackman",
] as const;

export type SuperinvestorPerformanceEnabledSlug =
  (typeof SUPERINVESTOR_PERFORMANCE_ENABLED_SLUGS)[number];

export type SuperinvestorPerformancePoint = {
  /** yyyy-MM-dd */
  t: string;
  /** Cumulative return % of disclosed 13F long book (buy-and-hold between filings). */
  bookReturnPct: number;
  /** Cumulative return % of SPY over the same window. */
  spyReturnPct: number;
  /** $ P&L on {@link SUPERINVESTOR_PERF_NOTIONAL_USD} following the 13F book. */
  bookProfitUsd: number;
  /** $ P&L on the same notional in SPY. */
  spyProfitUsd: number;
};

export type SuperinvestorPerformanceSeries = {
  slug: string;
  label: string;
  benchmarkLabel: string;
  notionalUsd: number;
  fromYmd: string;
  toYmd: string;
  points: SuperinvestorPerformancePoint[];
  /** Share of names in the first book that had EOD prices. */
  coveragePct: number | null;
  disclaimer: string;
};

export function isSuperinvestorPerformanceEnabled(slug: string): boolean {
  return (SUPERINVESTOR_PERFORMANCE_ENABLED_SLUGS as readonly string[]).includes(slug);
}
