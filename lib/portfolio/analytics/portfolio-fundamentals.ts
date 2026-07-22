/**
 * Portfolio fundamental aggregations (P/E, margins, ROCE, cash conversion).
 */

import {
  ANALYTICS_FUNDAMENTAL_COVERAGE_MIN,
  ANALYTICS_PERIOD_1Y,
  availableMetric,
  unavailableMetric,
  type AnalyticsMetricResult,
  type HoldingExclusionReason,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";

export type HoldingFundamentalInput = {
  symbol: string;
  marketValue: number;
  /** Trailing / reported P/E (>0). Null if missing or not applicable. */
  pe: number | null;
  /** Gross margin as decimal (0.4 = 40%) or already percent — see {@link marginIsPercent}. */
  grossMargin: number | null;
  operatingMargin: number | null;
  /** ROCE as decimal (0.15 = 15%). */
  roce: number | null;
  /** OCF / Net Income. */
  cashConversion: number | null;
  kind: "equity" | "etf" | "crypto" | "cash" | "other";
  /** When true, margin fields are already in percent units (e.g. 40). */
  marginIsPercent?: boolean;
};

export type FundamentalExclusion = { symbol: string; reason: HoldingExclusionReason };

function toDecimalMargin(v: number, isPercent?: boolean): number {
  if (isPercent) return v / 100;
  // Heuristic: values > 2 are almost certainly percent
  if (Math.abs(v) > 2) return v / 100;
  return v;
}

function coverageResult(
  value: number | null,
  coveredMv: number,
  eligibleMv: number,
  asOf: string | null,
  observations: number,
): AnalyticsMetricResult {
  const coverage = eligibleMv > 0 ? coveredMv / eligibleMv : 0;
  if (value == null || !Number.isFinite(value)) {
    return unavailableMetric("INSUFFICIENT_COVERAGE", {
      observations,
      period: ANALYTICS_PERIOD_1Y,
      coverage,
      asOf,
    });
  }
  if (coverage + 1e-9 < ANALYTICS_FUNDAMENTAL_COVERAGE_MIN) {
    return unavailableMetric("INSUFFICIENT_COVERAGE", {
      observations,
      period: ANALYTICS_PERIOD_1Y,
      coverage,
      asOf,
    });
  }
  return availableMetric(value, {
    observations,
    period: ANALYTICS_PERIOD_1Y,
    coverage,
    asOf,
  });
}

/**
 * Portfolio P/E via earnings-yield aggregation:
 * E/P = Σ(w_i × 1/PE_i) over eligible positive-PE names; P/E = 1 / (E/P).
 * Excludes cash, crypto; ETFs only if they expose a positive PE.
 * Negative/zero PE → excluded (NEGATIVE_EARNINGS), not zeroed.
 */
export function aggregatePortfolioPe(
  holdings: readonly HoldingFundamentalInput[],
  asOf: string | null,
): { metric: AnalyticsMetricResult; exclusions: FundamentalExclusion[] } {
  const exclusions: FundamentalExclusion[] = [];
  let eligibleMv = 0;
  let coveredMv = 0;
  let epWeighted = 0;

  for (const h of holdings) {
    if (h.marketValue <= 0) {
      exclusions.push({ symbol: h.symbol, reason: "ZERO_WEIGHT" });
      continue;
    }
    if (h.kind === "cash") {
      exclusions.push({ symbol: h.symbol, reason: "CASH" });
      continue;
    }
    if (h.kind === "crypto") {
      exclusions.push({ symbol: h.symbol, reason: "CRYPTO" });
      continue;
    }
    eligibleMv += h.marketValue;
    if (h.kind === "etf" && (h.pe == null || !(h.pe > 0))) {
      exclusions.push({ symbol: h.symbol, reason: "ETF_UNSUPPORTED" });
      continue;
    }
    if (h.pe == null || !Number.isFinite(h.pe)) {
      exclusions.push({ symbol: h.symbol, reason: "MISSING_FUNDAMENTALS" });
      continue;
    }
    if (h.pe <= 0) {
      exclusions.push({ symbol: h.symbol, reason: "NEGATIVE_EARNINGS" });
      continue;
    }
    coveredMv += h.marketValue;
    epWeighted += h.marketValue * (1 / h.pe);
  }

  if (eligibleMv <= 0) {
    return {
      metric: unavailableMetric("NO_ELIGIBLE_HOLDINGS", { asOf, coverage: 0 }),
      exclusions,
    };
  }
  if (coveredMv <= 0 || epWeighted <= 0) {
    return {
      metric: unavailableMetric("INSUFFICIENT_COVERAGE", {
        asOf,
        coverage: 0,
        observations: 0,
      }),
      exclusions,
    };
  }
  const pe = coveredMv / epWeighted;
  return {
    metric: coverageResult(pe, coveredMv, eligibleMv, asOf, holdings.length),
    exclusions,
  };
}

/** Market-value-weighted margin (returned as percent). */
export function aggregateWeightedMargin(
  holdings: readonly HoldingFundamentalInput[],
  field: "grossMargin" | "operatingMargin",
  asOf: string | null,
): { metric: AnalyticsMetricResult; exclusions: FundamentalExclusion[] } {
  const exclusions: FundamentalExclusion[] = [];
  let eligibleMv = 0;
  let coveredMv = 0;
  let num = 0;

  for (const h of holdings) {
    if (h.marketValue <= 0) continue;
    if (h.kind === "cash") {
      exclusions.push({ symbol: h.symbol, reason: "CASH" });
      continue;
    }
    if (h.kind === "crypto") {
      exclusions.push({ symbol: h.symbol, reason: "CRYPTO" });
      continue;
    }
    eligibleMv += h.marketValue;
    if (h.kind === "etf") {
      exclusions.push({ symbol: h.symbol, reason: "ETF_UNSUPPORTED" });
      continue;
    }
    const raw = h[field];
    if (raw == null || !Number.isFinite(raw)) {
      exclusions.push({ symbol: h.symbol, reason: "MISSING_FUNDAMENTALS" });
      continue;
    }
    const dec = toDecimalMargin(raw, h.marginIsPercent);
    if (!Number.isFinite(dec) || dec < -1 || dec > 2) {
      exclusions.push({ symbol: h.symbol, reason: "INVALID_VALUE" });
      continue;
    }
    coveredMv += h.marketValue;
    num += h.marketValue * dec;
  }

  if (eligibleMv <= 0) {
    return { metric: unavailableMetric("NO_ELIGIBLE_HOLDINGS", { asOf }), exclusions };
  }
  const pct = coveredMv > 0 ? (num / coveredMv) * 100 : null;
  return {
    metric: coverageResult(pct, coveredMv, eligibleMv, asOf, holdings.length),
    exclusions,
  };
}

/** Market-value-weighted ROCE (returned as percent). */
export function aggregateWeightedRoce(
  holdings: readonly HoldingFundamentalInput[],
  asOf: string | null,
): { metric: AnalyticsMetricResult; exclusions: FundamentalExclusion[] } {
  const exclusions: FundamentalExclusion[] = [];
  let eligibleMv = 0;
  let coveredMv = 0;
  let num = 0;

  for (const h of holdings) {
    if (h.marketValue <= 0) continue;
    if (h.kind === "cash") {
      exclusions.push({ symbol: h.symbol, reason: "CASH" });
      continue;
    }
    if (h.kind === "crypto") {
      exclusions.push({ symbol: h.symbol, reason: "CRYPTO" });
      continue;
    }
    eligibleMv += h.marketValue;
    if (h.kind === "etf") {
      exclusions.push({ symbol: h.symbol, reason: "ETF_UNSUPPORTED" });
      continue;
    }
    if (h.roce == null || !Number.isFinite(h.roce)) {
      exclusions.push({ symbol: h.symbol, reason: "MISSING_FUNDAMENTALS" });
      continue;
    }
    let dec = h.roce;
    if (Math.abs(dec) > 2) dec = dec / 100;
    coveredMv += h.marketValue;
    num += h.marketValue * dec;
  }

  if (eligibleMv <= 0) {
    return { metric: unavailableMetric("NO_ELIGIBLE_HOLDINGS", { asOf }), exclusions };
  }
  const pct = coveredMv > 0 ? (num / coveredMv) * 100 : null;
  return {
    metric: coverageResult(pct, coveredMv, eligibleMv, asOf, holdings.length),
    exclusions,
  };
}

/**
 * Cash conversion = OCF / Net Income (same as stock Key Stats).
 * Portfolio: market-value-weighted constituent ratios.
 */
export function aggregateWeightedCashConversion(
  holdings: readonly HoldingFundamentalInput[],
  asOf: string | null,
): { metric: AnalyticsMetricResult; exclusions: FundamentalExclusion[] } {
  const exclusions: FundamentalExclusion[] = [];
  let eligibleMv = 0;
  let coveredMv = 0;
  let num = 0;

  for (const h of holdings) {
    if (h.marketValue <= 0) continue;
    if (h.kind === "cash") {
      exclusions.push({ symbol: h.symbol, reason: "CASH" });
      continue;
    }
    if (h.kind === "crypto") {
      exclusions.push({ symbol: h.symbol, reason: "CRYPTO" });
      continue;
    }
    eligibleMv += h.marketValue;
    if (h.kind === "etf") {
      exclusions.push({ symbol: h.symbol, reason: "ETF_UNSUPPORTED" });
      continue;
    }
    if (h.cashConversion == null || !Number.isFinite(h.cashConversion)) {
      exclusions.push({ symbol: h.symbol, reason: "MISSING_FUNDAMENTALS" });
      continue;
    }
    coveredMv += h.marketValue;
    num += h.marketValue * h.cashConversion;
  }

  if (eligibleMv <= 0) {
    return { metric: unavailableMetric("NO_ELIGIBLE_HOLDINGS", { asOf }), exclusions };
  }
  const v = coveredMv > 0 ? num / coveredMv : null;
  return {
    metric: coverageResult(v, coveredMv, eligibleMv, asOf, holdings.length),
    exclusions,
  };
}
