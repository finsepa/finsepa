/**
 * Risk metrics from canonical daily returns (Sharpe, Sortino, Volatility, Beta).
 */

import {
  ANALYTICS_ANNUALIZATION,
  ANALYTICS_MIN_DAILY_OBS,
  ANALYTICS_PERIOD_1Y,
  availableMetric,
  unavailableMetric,
  type AnalyticsMetricResult,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";
import type { DailyReturnPoint } from "@/lib/portfolio/analytics/portfolio-return-series";
import { alignPairedReturns } from "@/lib/portfolio/analytics/portfolio-return-series";

/** Sample standard deviation (N−1). */
export function sampleStdDev(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  let ss = 0;
  for (const x of xs) {
    const d = x - mean;
    ss += d * d;
  }
  const v = ss / (xs.length - 1);
  return v >= 0 ? Math.sqrt(v) : null;
}

export function sampleMean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Annualized volatility from daily returns. */
export function computeAnnualizedVolatility(
  returns: readonly DailyReturnPoint[],
  asOf: string | null,
): AnalyticsMetricResult {
  if (returns.length < ANALYTICS_MIN_DAILY_OBS) {
    return unavailableMetric("INSUFFICIENT_HISTORY", {
      observations: returns.length,
      period: ANALYTICS_PERIOD_1Y,
      asOf,
    });
  }
  const xs = returns.map((p) => p.r);
  const sd = sampleStdDev(xs);
  if (sd == null) {
    return unavailableMetric("INSUFFICIENT_HISTORY", { observations: returns.length, asOf });
  }
  if (sd < 1e-12) {
    return unavailableMetric("ZERO_VOLATILITY", { observations: returns.length, asOf });
  }
  const ann = sd * Math.sqrt(ANALYTICS_ANNUALIZATION) * 100;
  return availableMetric(ann, { observations: returns.length, period: ANALYTICS_PERIOD_1Y, asOf });
}

/**
 * Annualized Sharpe using daily excess returns.
 * @param dailyRf risk-free return per day (decimal), e.g. annual%/100/252
 */
export function computeSharpeRatio(
  returns: readonly DailyReturnPoint[],
  dailyRf: number | null,
  asOf: string | null,
): AnalyticsMetricResult {
  if (dailyRf == null || !Number.isFinite(dailyRf)) {
    return unavailableMetric("MISSING_RISK_FREE", { observations: returns.length, asOf });
  }
  if (returns.length < ANALYTICS_MIN_DAILY_OBS) {
    return unavailableMetric("INSUFFICIENT_HISTORY", {
      observations: returns.length,
      period: ANALYTICS_PERIOD_1Y,
      asOf,
    });
  }
  const excess = returns.map((p) => p.r - dailyRf);
  const meanEx = sampleMean(excess);
  const sdEx = sampleStdDev(excess);
  if (meanEx == null || sdEx == null) {
    return unavailableMetric("INSUFFICIENT_HISTORY", { observations: returns.length, asOf });
  }
  if (sdEx < 1e-12) {
    return unavailableMetric("ZERO_VOLATILITY", { observations: returns.length, asOf });
  }
  const sharpe = (meanEx / sdEx) * Math.sqrt(ANALYTICS_ANNUALIZATION);
  if (!Number.isFinite(sharpe)) {
    return unavailableMetric("INVALID_INPUT", { observations: returns.length, asOf });
  }
  return availableMetric(sharpe, { observations: returns.length, period: ANALYTICS_PERIOD_1Y, asOf });
}

/**
 * Annualized Sortino — downside deviation vs dailyRf (MAR).
 * Zero downside → unavailable (never infinity).
 */
export function computeSortinoRatio(
  returns: readonly DailyReturnPoint[],
  dailyRf: number | null,
  asOf: string | null,
): AnalyticsMetricResult {
  if (dailyRf == null || !Number.isFinite(dailyRf)) {
    return unavailableMetric("MISSING_RISK_FREE", { observations: returns.length, asOf });
  }
  if (returns.length < ANALYTICS_MIN_DAILY_OBS) {
    return unavailableMetric("INSUFFICIENT_HISTORY", {
      observations: returns.length,
      period: ANALYTICS_PERIOD_1Y,
      asOf,
    });
  }
  const excess = returns.map((p) => p.r - dailyRf);
  const meanEx = sampleMean(excess);
  if (meanEx == null) {
    return unavailableMetric("INSUFFICIENT_HISTORY", { observations: returns.length, asOf });
  }
  const downside = excess.map((e) => (e < 0 ? e : 0));
  const negCount = downside.filter((d) => d < 0).length;
  if (negCount === 0) {
    return unavailableMetric("ZERO_DOWNSIDE", { observations: returns.length, asOf });
  }
  // Downside deviation: sqrt(mean of min(r-MAR,0)^2) using full N (Sortino convention)
  let ss = 0;
  for (const d of downside) ss += d * d;
  const dd = Math.sqrt(ss / excess.length);
  if (dd < 1e-12) {
    return unavailableMetric("ZERO_DOWNSIDE", { observations: returns.length, asOf });
  }
  const sortino = (meanEx / dd) * Math.sqrt(ANALYTICS_ANNUALIZATION);
  if (!Number.isFinite(sortino)) {
    return unavailableMetric("INVALID_INPUT", { observations: returns.length, asOf });
  }
  return availableMetric(sortino, { observations: returns.length, period: ANALYTICS_PERIOD_1Y, asOf });
}

export function computeBeta(
  portfolio: readonly DailyReturnPoint[],
  benchmark: readonly DailyReturnPoint[],
  asOf: string | null,
): AnalyticsMetricResult {
  const paired = alignPairedReturns(portfolio, benchmark);
  if (paired.length < ANALYTICS_MIN_DAILY_OBS) {
    return unavailableMetric("INSUFFICIENT_OVERLAP", {
      observations: paired.length,
      period: ANALYTICS_PERIOD_1Y,
      asOf,
      coverage: paired.length > 0 ? paired.length / Math.max(portfolio.length, 1) : 0,
    });
  }
  const rp = paired.map((p) => p.rp);
  const rb = paired.map((p) => p.rb);
  const meanP = sampleMean(rp)!;
  const meanB = sampleMean(rb)!;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < paired.length; i++) {
    const dp = rp[i]! - meanP;
    const db = rb[i]! - meanB;
    cov += dp * db;
    varB += db * db;
  }
  const n = paired.length - 1;
  if (n < 1) {
    return unavailableMetric("INSUFFICIENT_OVERLAP", { observations: paired.length, asOf });
  }
  cov /= n;
  varB /= n;
  if (varB < 1e-18) {
    return unavailableMetric("ZERO_BENCHMARK_VARIANCE", { observations: paired.length, asOf });
  }
  const beta = cov / varB;
  if (!Number.isFinite(beta)) {
    return unavailableMetric("INVALID_INPUT", { observations: paired.length, asOf });
  }
  return availableMetric(beta, {
    observations: paired.length,
    period: ANALYTICS_PERIOD_1Y,
    asOf,
    coverage: paired.length / Math.max(portfolio.length, 1),
  });
}
