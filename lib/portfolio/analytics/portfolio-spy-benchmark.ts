/**
 * S&P 500 (SPY) Key Stats benchmark values for portfolio comparison tooltips.
 * Portfolio metric formulas are unchanged — this only supplies the compare-to side.
 */

import type { HoldingFundamentalInput } from "@/lib/portfolio/analytics/portfolio-fundamentals";
import {
  ANALYTICS_ANNUALIZATION,
  ANALYTICS_PERIOD_1Y,
  availableMetric,
  unavailableMetric,
  type AnalyticsMetricResult,
  type PortfolioAnalyticsBenchmark,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";
import type { DailyReturnPoint } from "@/lib/portfolio/analytics/portfolio-return-series";
import {
  computeAnnualizedVolatility,
  computeSharpeRatio,
  computeSortinoRatio,
} from "@/lib/portfolio/analytics/portfolio-risk-metrics";

/** Minimal close series (compatible with EODHD daily bars). */
export type SpyCloseBar = { date: string; close: number };

function toDecimalMargin(v: number): number {
  if (Math.abs(v) > 2) return v / 100;
  return v;
}

function optionalRatio(value: number | null, asOf: string, observations = 1): AnalyticsMetricResult {
  if (value == null || !Number.isFinite(value)) {
    return unavailableMetric("INSUFFICIENT_COVERAGE", { asOf, observations: 0, coverage: 0 });
  }
  return availableMetric(value, { observations, period: ANALYTICS_PERIOD_1Y, asOf, coverage: 1 });
}

function optionalPctFromDecimal(value: number | null, asOf: string): AnalyticsMetricResult {
  if (value == null || !Number.isFinite(value)) {
    return unavailableMetric("INSUFFICIENT_COVERAGE", { asOf, observations: 0, coverage: 0 });
  }
  const dec = toDecimalMargin(value);
  if (!Number.isFinite(dec) || dec < -1 || dec > 2) {
    return unavailableMetric("INVALID_INPUT", { asOf, observations: 0 });
  }
  return availableMetric(dec * 100, { observations: 1, period: ANALYTICS_PERIOD_1Y, asOf, coverage: 1 });
}

/** Simple daily price returns from session closes (SPY buy-and-hold). */
export function buildSpyPriceDailyReturns(bars: readonly SpyCloseBar[]): DailyReturnPoint[] {
  const sorted = [...bars]
    .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.date) && Number.isFinite(b.close) && b.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: DailyReturnPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const r = cur.close / prev.close - 1;
    if (!Number.isFinite(r)) continue;
    out.push({ date: cur.date, r, coverage: 1 });
  }
  return out;
}

export function computeSpyBenchmarkMetrics(args: {
  asOf: string;
  benchBars: readonly SpyCloseBar[];
  dailyRf: number | null;
  spyFundamentals: HoldingFundamentalInput | null;
  /** Preferred S&P trailing P/E (e.g. Shiller series) when ETF Highlights omit PE. */
  sp500TrailingPe?: number | null;
}): PortfolioAnalyticsBenchmark {
  const empty = unavailableMetric("PROVIDER_FAILURE", { asOf: args.asOf });
  const fundEmpty = unavailableMetric("INSUFFICIENT_COVERAGE", { asOf: args.asOf, coverage: 0 });

  const spyRets = buildSpyPriceDailyReturns(args.benchBars).slice(-ANALYTICS_ANNUALIZATION);
  const f = args.spyFundamentals;
  const peValue =
    args.sp500TrailingPe != null && args.sp500TrailingPe > 0
      ? args.sp500TrailingPe
      : f?.pe != null && f.pe > 0
        ? f.pe
        : null;

  return {
    ticker: "SPY",
    label: "S&P 500",
    sharpe: spyRets.length ? computeSharpeRatio(spyRets, args.dailyRf, args.asOf) : empty,
    sortino: spyRets.length ? computeSortinoRatio(spyRets, args.dailyRf, args.asOf) : empty,
    volatility: spyRets.length ? computeAnnualizedVolatility(spyRets, args.asOf) : empty,
    /** By construction vs SPY. */
    beta: availableMetric(1, {
      observations: spyRets.length,
      period: ANALYTICS_PERIOD_1Y,
      asOf: args.asOf,
      coverage: 1,
    }),
    /** ETF turnover not in portfolio engine — leave unavailable (no fake number). */
    turnover: unavailableMetric("NO_ELIGIBLE_HOLDINGS", { asOf: args.asOf }),
    pe: peValue != null ? optionalRatio(peValue, args.asOf) : fundEmpty,
    grossMargin: optionalPctFromDecimal(f?.grossMargin ?? null, args.asOf),
    operatingMargin: optionalPctFromDecimal(f?.operatingMargin ?? null, args.asOf),
    roce: optionalPctFromDecimal(f?.roce ?? null, args.asOf),
    cashConversion:
      f?.cashConversion != null && Number.isFinite(f.cashConversion)
        ? optionalRatio(f.cashConversion, args.asOf)
        : fundEmpty,
  };
}
