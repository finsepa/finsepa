import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";

/** Hypothetical starting capital for $ profit series (both book and S&P). */
export const SUPERINVESTOR_PERF_NOTIONAL_USD = 10_000;

/**
 * Phase 1 rollout (historical) — first 10 managers in {@link SUPERINVESTOR_REGISTRY} order.
 * @deprecated All tracked managers are now enabled via {@link SUPERINVESTOR_PERFORMANCE_CRON_SLUGS}.
 */
export const SUPERINVESTOR_PERFORMANCE_TOP10_SLUGS = [
  "berkshire-hathaway",
  "bill-ackman",
  "terry-smith",
  "michael-burry",
  "cathie-wood",
  "li-lu",
  "ray-dalio",
  "ken-fisher",
  "primecap-management",
  "ken-griffin",
] as const satisfies readonly (keyof typeof SUPERINVESTOR_SLUG_CIK)[];

/** Stable order for cron sharding — every superinvestor with a CIK mapping. */
export const SUPERINVESTOR_PERFORMANCE_CRON_SLUGS = Object.keys(SUPERINVESTOR_SLUG_CIK).sort() as readonly string[];

/** @deprecated Prefer {@link SUPERINVESTOR_PERFORMANCE_CRON_SLUGS}. */
export const SUPERINVESTOR_PERFORMANCE_ENABLED_SLUGS = SUPERINVESTOR_PERFORMANCE_CRON_SLUGS;

export type SuperinvestorPerformanceEnabledSlug = keyof typeof SUPERINVESTOR_SLUG_CIK;

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
  return Object.prototype.hasOwnProperty.call(SUPERINVESTOR_SLUG_CIK, slug);
}

/** Slugs assigned to a cron shard (0-based). */
export function superinvestorPerformanceSlugsForShard(shard: number, shards: number): readonly string[] {
  const all = SUPERINVESTOR_PERFORMANCE_CRON_SLUGS;
  if (shards < 1) return all;
  const clampedShard = Math.max(0, Math.min(shard, shards - 1));
  return all.filter((_, index) => index % shards === clampedShard);
}
