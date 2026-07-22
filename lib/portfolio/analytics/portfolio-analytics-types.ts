/**
 * Shared portfolio analytics result envelope (Phase 4).
 */

export type AnalyticsStatus = "available" | "unavailable";

export type AnalyticsUnavailableReason =
  | "INSUFFICIENT_HISTORY"
  | "INSUFFICIENT_COVERAGE"
  | "INSUFFICIENT_OVERLAP"
  | "ZERO_VOLATILITY"
  | "ZERO_DOWNSIDE"
  | "ZERO_BENCHMARK_VARIANCE"
  | "ZERO_DENOMINATOR"
  | "MISSING_RISK_FREE"
  | "NO_HOLDINGS"
  | "NO_ELIGIBLE_HOLDINGS"
  | "PROVIDER_FAILURE"
  | "INVALID_INPUT";

export type AnalyticsMetricResult = {
  value: number | null;
  status: AnalyticsStatus;
  observations: number;
  period: string;
  coverage: number | null;
  asOf: string | null;
  reason?: AnalyticsUnavailableReason;
};

export type HoldingExclusionReason =
  | "CASH"
  | "CRYPTO"
  | "ETF_UNSUPPORTED"
  | "MISSING_FUNDAMENTALS"
  | "NEGATIVE_EARNINGS"
  | "STALE_DATA"
  | "INVALID_VALUE"
  | "ZERO_WEIGHT";

export type PortfolioAnalyticsSnapshot = {
  asOf: string;
  sharpe: AnalyticsMetricResult;
  sortino: AnalyticsMetricResult;
  volatility: AnalyticsMetricResult;
  beta: AnalyticsMetricResult;
  turnover: AnalyticsMetricResult;
  pe: AnalyticsMetricResult;
  grossMargin: AnalyticsMetricResult;
  operatingMargin: AnalyticsMetricResult;
  roce: AnalyticsMetricResult;
  cashConversion: AnalyticsMetricResult;
  /** S&P 500 (SPY) counterparts for Key Stats red/green compare — null if not computed. */
  benchmark?: PortfolioAnalyticsBenchmark | null;
};

/** Same metric keys as the portfolio snapshot, for tooltip / tone comparison. */
export type PortfolioAnalyticsBenchmark = {
  ticker: string;
  label: string;
  sharpe: AnalyticsMetricResult;
  sortino: AnalyticsMetricResult;
  volatility: AnalyticsMetricResult;
  beta: AnalyticsMetricResult;
  turnover: AnalyticsMetricResult;
  pe: AnalyticsMetricResult;
  grossMargin: AnalyticsMetricResult;
  operatingMargin: AnalyticsMetricResult;
  roce: AnalyticsMetricResult;
  cashConversion: AnalyticsMetricResult;
};

export const ANALYTICS_MIN_DAILY_OBS = 5;
export const ANALYTICS_PREFERRED_DAILY_OBS = 252;
export const ANALYTICS_ANNUALIZATION = 252;
/** Show fundamentals when this fraction of eligible MV has data (was 0.7 — too strict for crypto-heavy books). */
export const ANALYTICS_FUNDAMENTAL_COVERAGE_MIN = 0.2;
export const ANALYTICS_PERIOD_1Y = "1Y";
export const ANALYTICS_MAX_STALE_PRICE_DAYS = 5;

export function unavailableMetric(
  reason: AnalyticsUnavailableReason,
  opts?: Partial<Pick<AnalyticsMetricResult, "observations" | "period" | "coverage" | "asOf">>,
): AnalyticsMetricResult {
  return {
    value: null,
    status: "unavailable",
    observations: opts?.observations ?? 0,
    period: opts?.period ?? ANALYTICS_PERIOD_1Y,
    coverage: opts?.coverage ?? null,
    asOf: opts?.asOf ?? null,
    reason,
  };
}

export function availableMetric(
  value: number,
  opts: Partial<Pick<AnalyticsMetricResult, "observations" | "period" | "coverage" | "asOf">> & {
    observations: number;
  },
): AnalyticsMetricResult {
  return {
    value,
    status: "available",
    observations: opts.observations,
    period: opts.period ?? ANALYTICS_PERIOD_1Y,
    coverage: opts.coverage ?? null,
    asOf: opts.asOf ?? null,
  };
}
