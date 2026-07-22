/**
 * Phase 4 — portfolio analytics deterministic tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import {
  aggregatePortfolioPe,
  aggregateWeightedCashConversion,
  aggregateWeightedMargin,
  aggregateWeightedRoce,
  type HoldingFundamentalInput,
} from "./portfolio-fundamentals.ts";
import { deriveMarginsFromIncome } from "./derive-margins-from-income.ts";
import {
  alignPairedReturns,
  buildFlowAwareDailyReturns,
  type NavMark,
} from "./portfolio-return-series.ts";
import {
  buildSpyPriceDailyReturns,
  computeSpyBenchmarkMetrics,
} from "./portfolio-spy-benchmark.ts";
import {
  computeAnnualizedVolatility,
  computeBeta,
  computeSharpeRatio,
  computeSortinoRatio,
} from "./portfolio-risk-metrics.ts";
import { computePortfolioTurnover } from "./portfolio-turnover.ts";
import type { ExternalCashFlow } from "../returns/modified-dietz.ts";
import { ANALYTICS_ANNUALIZATION, ANALYTICS_MIN_DAILY_OBS } from "./portfolio-analytics-types.ts";
import {
  buildHoldingsLookthroughDailyReturns,
  pickRiskReturnSeries,
} from "./portfolio-lookthrough-returns.ts";

function dailySeries(
  n: number,
  baseR: number,
  start = "2024-01-02",
  jitter = 0.0003,
): { marks: NavMark[]; flows: ExternalCashFlow[] } {
  const marks: NavMark[] = [{ date: "2024-01-01", nav: 100_000, coverage: 1 }];
  let nav = 100_000;
  const d0 = Date.parse(`${start}T12:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(d0 + i * 86_400_000).toISOString().slice(0, 10);
    const r = baseR + ((i % 5) - 2) * jitter;
    nav = nav * (1 + r);
    marks.push({ date: d, nav, coverage: 1 });
  }
  return { marks, flows: [] };
}

describe("risk metrics", () => {
  it("A: constant positive return → finite Sharpe/vol", () => {
    const { marks, flows } = dailySeries(80, 0.001);
    const rets = buildFlowAwareDailyReturns(marks, flows);
    const vol = computeAnnualizedVolatility(rets, "2024-06-01");
    const sharpe = computeSharpeRatio(rets, 0.0001, "2024-06-01");
    assert.equal(vol.status, "available");
    assert.equal(sharpe.status, "available");
    assert.ok(vol.value != null && vol.value > 0);
    assert.ok(sharpe.value != null && Number.isFinite(sharpe.value));
  });

  it("B: flat returns → zero vol unavailable for Sharpe", () => {
    const { marks, flows } = dailySeries(80, 0, "2024-01-02", 0);
    const rets = buildFlowAwareDailyReturns(marks, flows);
    const vol = computeAnnualizedVolatility(rets, "2024-06-01");
    assert.equal(vol.status, "unavailable");
    assert.equal(vol.reason, "ZERO_VOLATILITY");
  });

  it("C: volatile series → higher vol than calm", () => {
    const calm = buildFlowAwareDailyReturns(dailySeries(80, 0.0005, "2024-01-02", 0.00005).marks, []);
    const wildMarks: NavMark[] = [{ date: "2024-01-01", nav: 100_000, coverage: 1 }];
    let nav = 100_000;
    for (let i = 0; i < 80; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      nav *= i % 2 === 0 ? 1.02 : 0.98;
      wildMarks.push({ date: d, nav, coverage: 1 });
    }
    const wild = buildFlowAwareDailyReturns(wildMarks, []);
    const vCalm = computeAnnualizedVolatility(calm, null);
    const vWild = computeAnnualizedVolatility(wild, null);
    assert.equal(vCalm.status, "available");
    assert.equal(vWild.status, "available");
    assert.ok((vWild.value ?? 0) > (vCalm.value ?? 0));
  });

  it("D: negative return series → negative Sharpe", () => {
    const { marks } = dailySeries(80, -0.001);
    const rets = buildFlowAwareDailyReturns(marks, []);
    const sharpe = computeSharpeRatio(rets, 0.00005, null);
    assert.equal(sharpe.status, "available");
    assert.ok(sharpe.value != null && sharpe.value < 0);
  });

  it("E: insufficient history → unavailable", () => {
    const { marks } = dailySeries(3, 0.001);
    const rets = buildFlowAwareDailyReturns(marks, []);
    const vol = computeAnnualizedVolatility(rets, null);
    assert.equal(vol.status, "unavailable");
    assert.equal(vol.reason, "INSUFFICIENT_HISTORY");
  });

  it("F: missing coverage skips observations", () => {
    const marks: NavMark[] = [
      { date: "2024-01-01", nav: 100, coverage: 1 },
      { date: "2024-01-02", nav: 101, coverage: 0.1 },
      { date: "2024-01-03", nav: 102, coverage: 1 },
    ];
    const rets = buildFlowAwareDailyReturns(marks, [], { minCoverage: 0.5 });
    assert.equal(rets.length, 0);
  });

  it("G: zero benchmark variance → unavailable beta", () => {
    const port = buildFlowAwareDailyReturns(dailySeries(80, 0.001).marks, []);
    const flatBench = port.map((p) => ({ ...p, r: 0 }));
    const beta = computeBeta(port, flatBench, null);
    assert.equal(beta.status, "unavailable");
    assert.equal(beta.reason, "ZERO_BENCHMARK_VARIANCE");
  });

  it("H: portfolio tracks benchmark → beta ≈ 1", () => {
    const port = buildFlowAwareDailyReturns(dailySeries(80, 0.001).marks, []);
    const beta = computeBeta(port, port, null);
    assert.equal(beta.status, "available");
    assert.ok(beta.value != null && Math.abs(beta.value - 1) < 1e-6);
  });

  it("I: double benchmark movement → beta ≈ 2", () => {
    const bench = buildFlowAwareDailyReturns(dailySeries(80, 0.001).marks, []);
    const port = bench.map((p) => ({ ...p, r: p.r * 2 }));
    const beta = computeBeta(port, bench, null);
    assert.equal(beta.status, "available");
    assert.ok(beta.value != null && Math.abs(beta.value - 2) < 1e-6);
  });

  it("J: uncorrelated → beta near 0", () => {
    const a = buildFlowAwareDailyReturns(dailySeries(100, 0.001).marks, []);
    const bMarks: NavMark[] = [{ date: "2024-01-01", nav: 100_000, coverage: 1 }];
    let nav = 100_000;
    for (let i = 0; i < 100; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      // Alternate sign vs constant positive series → low correlation
      nav *= i % 2 === 0 ? 1.002 : 0.998;
      bMarks.push({ date: d, nav, coverage: 1 });
    }
    const b = buildFlowAwareDailyReturns(bMarks, []);
    const beta = computeBeta(a, b, null);
    assert.equal(beta.status, "available");
    assert.ok(beta.value != null && Math.abs(beta.value) < 0.5);
  });

  it("K: downside Sortino case", () => {
    const marks: NavMark[] = [{ date: "2024-01-01", nav: 100_000, coverage: 1 }];
    let nav = 100_000;
    for (let i = 0; i < 80; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      nav *= i < 40 ? 1.002 : 0.995;
      marks.push({ date: d, nav, coverage: 1 });
    }
    const rets = buildFlowAwareDailyReturns(marks, []);
    const s = computeSortinoRatio(rets, 0, null);
    assert.equal(s.status, "available");
    assert.ok(s.value != null && Number.isFinite(s.value));
  });

  it("L: no downside → unavailable not infinity", () => {
    const { marks } = dailySeries(80, 0.001);
    const rets = buildFlowAwareDailyReturns(marks, []);
    const s = computeSortinoRatio(rets, -0.01, null); // MAR far below → no downside vs MAR? 
    // All returns ~0.001 > -0.01, excess positive → zero downside
    assert.equal(s.status, "unavailable");
    assert.equal(s.reason, "ZERO_DOWNSIDE");
    assert.equal(s.value, null);
  });

  it("M: deposit does not create volatility", () => {
    const marks: NavMark[] = [
      { date: "2024-01-01", nav: 100_000, coverage: 1 },
    ];
    let nav = 100_000;
    const flows: ExternalCashFlow[] = [];
    for (let i = 0; i < 80; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (i === 40) {
        flows.push({ date: d, amount: 100_000 });
        nav += 100_000;
      }
      marks.push({ date: d, nav, coverage: 1 });
    }
    const rets = buildFlowAwareDailyReturns(marks, flows);
    const vol = computeAnnualizedVolatility(rets, null);
    // Flat investment performance → zero / unavailable vol
    assert.ok(vol.status === "unavailable" || (vol.value != null && vol.value < 1));
  });

  it("N: fee reduces NAV and creates negative return observation", () => {
    const marks: NavMark[] = [
      { date: "2024-01-01", nav: 100_000, coverage: 1 },
      { date: "2024-01-02", nav: 99_900, coverage: 1 }, // fee as portfolio result (no CF)
    ];
    const rets = buildFlowAwareDailyReturns(marks, []);
    assert.equal(rets.length, 1);
    assert.ok(rets[0]!.r < 0);
  });
});

describe("fundamentals", () => {
  const asOf = "2026-07-21";

  it("P: two profitable companies different P/E", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 50, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.15, cashConversion: 1.1, kind: "equity" },
      { symbol: "B", marketValue: 50, pe: 20, grossMargin: 0.3, operatingMargin: 0.1, roce: 0.1, cashConversion: 0.9, kind: "equity" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "available");
    // Equal weights: EP = 0.5/10 + 0.5/20 = 0.075 → PE = 1/0.075 ≈ 13.333
    assert.ok(metric.value != null && Math.abs(metric.value - 100 / 7.5) < 1e-6);
  });

  it("Q: negative-earnings company excluded", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 80, pe: 15, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 20, pe: -5, grossMargin: 0.1, operatingMargin: -0.1, roce: -0.05, cashConversion: null, kind: "equity" },
    ];
    const { metric, exclusions } = aggregatePortfolioPe(holdings, asOf);
    assert.ok(exclusions.some((e) => e.reason === "NEGATIVE_EARNINGS"));
    assert.equal(metric.status, "available");
    assert.ok(metric.value != null && Math.abs(metric.value - 15) < 1e-6);
  });

  it("R: missing fundamentals reduce coverage", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 15, pe: 12, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 85, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "equity" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "unavailable");
    assert.equal(metric.reason, "INSUFFICIENT_COVERAGE");
  });

  it("S: cash-heavy — cash excluded from eligible", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "USD", marketValue: 90, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "cash" },
      { symbol: "A", marketValue: 10, pe: 12, grossMargin: 0.5, operatingMargin: 0.25, roce: 0.2, cashConversion: 1.2, kind: "equity" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "available");
    assert.ok(metric.value != null && Math.abs(metric.value - 12) < 1e-6);
  });

  it("T: ETF-heavy without PE → unavailable", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "SPY", marketValue: 100, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "etf" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "unavailable");
  });

  it("U: crypto-only → no eligible holdings", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "BTC", marketValue: 100, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "crypto" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "unavailable");
    assert.equal(metric.reason, "NO_ELIGIBLE_HOLDINGS");
  });

  it("V: coverage below 20% → unavailable", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 15, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 85, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "equity" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "unavailable");
  });

  it("W: coverage above 20% → available", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 25, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 75, pe: null, grossMargin: null, operatingMargin: null, roce: null, cashConversion: null, kind: "equity" },
    ];
    const { metric } = aggregatePortfolioPe(holdings, asOf);
    assert.equal(metric.status, "available");
  });

  it("X: weighted margin aggregation", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 75, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 25, pe: 12, grossMargin: 0.2, operatingMargin: 0.1, roce: 0.05, cashConversion: 0.8, kind: "equity" },
    ];
    const { metric } = aggregateWeightedMargin(holdings, "grossMargin", asOf);
    assert.equal(metric.status, "available");
    // 0.75*0.4 + 0.25*0.2 = 0.35 → 35%
    assert.ok(metric.value != null && Math.abs(metric.value - 35) < 1e-6);
  });

  it("Y: ROCE aggregation", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 50, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.2, cashConversion: 1, kind: "equity" },
      { symbol: "B", marketValue: 50, pe: 12, grossMargin: 0.3, operatingMargin: 0.1, roce: 0.1, cashConversion: 1, kind: "equity" },
    ];
    const { metric } = aggregateWeightedRoce(holdings, asOf);
    assert.equal(metric.status, "available");
    assert.ok(metric.value != null && Math.abs(metric.value - 15) < 1e-6);
  });

  it("Z: cash conversion = OCF/NI weighted", () => {
    const holdings: HoldingFundamentalInput[] = [
      { symbol: "A", marketValue: 50, pe: 10, grossMargin: 0.4, operatingMargin: 0.2, roce: 0.1, cashConversion: 1.2, kind: "equity" },
      { symbol: "B", marketValue: 50, pe: 12, grossMargin: 0.3, operatingMargin: 0.1, roce: 0.1, cashConversion: 0.8, kind: "equity" },
    ];
    const { metric } = aggregateWeightedCashConversion(holdings, asOf);
    assert.equal(metric.status, "available");
    assert.ok(metric.value != null && Math.abs(metric.value - 1) < 1e-6);
  });
});

describe("turnover", () => {
  function trade(
    id: string,
    op: string,
    date: string,
    sum: number,
  ): PortfolioTransaction {
    return {
      id,
      portfolioId: "p1",
      kind: "trade",
      operation: op,
      symbol: "AAA",
      name: "AAA",
      logoUrl: null,
      date,
      shares: 1,
      price: Math.abs(sum),
      sum,
      fee: 0,
      profitPct: null,
      profitUsd: null,
      sequence: 1,
    };
  }

  it("AA: no trades → 0%", () => {
    const m = computePortfolioTurnover({
      transactions: [],
      averageEquityUsd: 10_000,
      asOfYmd: "2026-07-21",
    });
    assert.equal(m.status, "available");
    assert.equal(m.value, 0);
  });

  it("AB: buys only → turnover 0 (min(buys,sells)=0)", () => {
    const m = computePortfolioTurnover({
      transactions: [trade("1", "Buy", "2026-01-15", -5_000)],
      averageEquityUsd: 10_000,
      asOfYmd: "2026-07-21",
    });
    assert.equal(m.status, "available");
    assert.equal(m.value, 0);
  });

  it("AC: buys and sells", () => {
    const m = computePortfolioTurnover({
      transactions: [
        trade("1", "Buy", "2026-01-15", -8_000),
        trade("2", "Sell", "2026-03-01", 4_000),
      ],
      averageEquityUsd: 10_000,
      asOfYmd: "2026-07-21",
    });
    assert.equal(m.status, "available");
    // min(8000,4000)/10000 * 100 = 40
    assert.ok(m.value != null && Math.abs(m.value - 40) < 1e-6);
  });

  it("AD: deposit does not count", () => {
    const m = computePortfolioTurnover({
      transactions: [
        {
          id: "c",
          portfolioId: "p1",
          kind: "cash",
          operation: "Cash In",
          symbol: "USD",
          name: "USD",
          logoUrl: null,
          date: "2026-02-01",
          shares: 50_000,
          price: 1,
          sum: 50_000,
          fee: 0,
          profitPct: null,
          profitUsd: null,
          sequence: 1,
        },
        trade("1", "Buy", "2026-02-02", -5_000),
        trade("2", "Sell", "2026-02-03", 5_000),
      ],
      averageEquityUsd: 10_000,
      asOfYmd: "2026-07-21",
    });
    assert.equal(m.status, "available");
    assert.ok(m.value != null && Math.abs(m.value - 50) < 1e-6);
  });

  it("AE: full exit and rebuy counts both sides", () => {
    const m = computePortfolioTurnover({
      transactions: [
        trade("1", "Buy", "2026-01-10", -10_000),
        trade("2", "Sell", "2026-02-10", 10_000),
        trade("3", "Buy", "2026-03-10", -10_000),
      ],
      averageEquityUsd: 10_000,
      asOfYmd: "2026-07-21",
    });
    assert.equal(m.status, "available");
    // buys=20k sells=10k → min/avg = 100%
    assert.ok(m.value != null && Math.abs(m.value - 100) < 1e-6);
  });
});

describe("gross margin income-statement fallback", () => {
  it("AF: GrossProfit / Revenue when Highlights omit GrossMarginTTM", () => {
    const { gross, operating } = deriveMarginsFromIncome(null, {
      totalRevenue: 1000,
      grossProfit: 400,
      operatingIncome: 200,
    });
    assert.ok(gross != null && Math.abs(gross - 0.4) < 1e-9);
    assert.ok(operating != null && Math.abs(operating - 0.2) < 1e-9);
  });

  it("AG: derived gross feeds coverage aggregation", () => {
    const derived = deriveMarginsFromIncome({ RevenueTTM: 500 }, { grossProfit: 250 });
    assert.ok(derived.gross != null && Math.abs(derived.gross - 0.5) < 1e-9);
    const holdings: HoldingFundamentalInput[] = [
      {
        symbol: "A",
        marketValue: 100,
        pe: 12,
        grossMargin: derived.gross,
        operatingMargin: 0.2,
        roce: 0.1,
        cashConversion: 1,
        kind: "equity",
      },
    ];
    const { metric } = aggregateWeightedMargin(holdings, "grossMargin", "2026-07-21");
    assert.equal(metric.status, "available");
    assert.ok(metric.value != null && Math.abs(metric.value - 50) < 1e-6);
  });
});

describe("beta calendar alignment", () => {
  it("AH: trim-then-align fails when series windows differ; align-then-trim succeeds", () => {
    const long = buildFlowAwareDailyReturns(dailySeries(200, 0.001, "2024-01-02").marks, []);
    // Benchmark only overlaps the *early* window — independent trailing trim desyncs.
    const early = long.slice(0, 3);
    const shortMarks: NavMark[] = [];
    let nav = 100_000;
    for (let i = 0; i < early.length; i++) {
      const d = early[i]!.date;
      if (shortMarks.length === 0) {
        const prev = new Date(Date.parse(`${d}T12:00:00.000Z`) - 86_400_000)
          .toISOString()
          .slice(0, 10);
        shortMarks.push({ date: prev, nav, coverage: 1 });
      }
      nav *= 1 + early[i]!.r;
      shortMarks.push({ date: d, nav, coverage: 1 });
    }
    const short = buildFlowAwareDailyReturns(shortMarks, []);

    const portTrim = long.slice(-ANALYTICS_ANNUALIZATION);
    const benchTrim = short.slice(-ANALYTICS_ANNUALIZATION);
    const bad = computeBeta(portTrim, benchTrim, null);
    assert.equal(bad.status, "unavailable");
    assert.equal(bad.reason, "INSUFFICIENT_OVERLAP");

    // Full long series paired with early bench still only has early overlap — seed a
    // late-overlapping bench that is still shorter than the portfolio trailing window.
    const late = long.slice(-80);
    const lateMarks: NavMark[] = [];
    nav = 100_000;
    for (let i = 0; i < late.length; i++) {
      const d = late[i]!.date;
      if (lateMarks.length === 0) {
        const prev = new Date(Date.parse(`${d}T12:00:00.000Z`) - 86_400_000)
          .toISOString()
          .slice(0, 10);
        lateMarks.push({ date: prev, nav, coverage: 1 });
      }
      nav *= 1 + late[i]!.r;
      lateMarks.push({ date: d, nav, coverage: 1 });
    }
    const lateBench = buildFlowAwareDailyReturns(lateMarks, []);

    // Mimic the old bug: take last 252 of a *longer* synthetic port that extends
    // before lateBench, so trailing port dates mostly miss lateBench if we had
    // trimmed differently — here align-then-trim on (long, lateBench) recovers β≈1.
    const paired = alignPairedReturns(long, lateBench).slice(-ANALYTICS_ANNUALIZATION);
    assert.ok(paired.length >= 5);
    const portForBeta = paired.map((p) => ({ date: p.date, r: p.rp, coverage: 1 }));
    const benchForBeta = paired.map((p) => ({ date: p.date, r: p.rb, coverage: 1 }));
    const good = computeBeta(portForBeta, benchForBeta, null);
    assert.equal(good.status, "available");
    assert.ok(good.value != null && Math.abs(good.value - 1) < 1e-6);
  });
});

describe("SPY benchmark compare side", () => {
  it("AI: SPY price returns + beta benchmark is 1", () => {
    const bars: { date: string; close: number }[] = [];
    let px = 400;
    for (let i = 0; i < 100; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      px *= 1 + 0.001 + ((i % 5) - 2) * 0.0004;
      bars.push({ date: d, close: px });
    }
    const rets = buildSpyPriceDailyReturns(bars);
    assert.ok(rets.length >= 60);
    const bench = computeSpyBenchmarkMetrics({
      asOf: "2024-06-01",
      benchBars: bars,
      dailyRf: 0.0001,
      spyFundamentals: {
        symbol: "SPY",
        marketValue: 1,
        pe: null,
        grossMargin: 0.42,
        operatingMargin: 0.22,
        roce: 0.18,
        cashConversion: 1.08,
        kind: "etf",
      },
      sp500TrailingPe: 20.3,
    });
    assert.equal(bench.beta.status, "available");
    assert.equal(bench.beta.value, 1);
    assert.equal(bench.pe.status, "available");
    assert.ok(bench.pe.value != null && Math.abs(bench.pe.value - 20.3) < 1e-9);
    assert.equal(bench.grossMargin.status, "available");
    assert.ok(bench.grossMargin.value != null && Math.abs(bench.grossMargin.value - 42) < 1e-6);
    assert.equal(bench.sharpe.status, "available");
    assert.equal(bench.turnover.status, "unavailable");
  });
});

describe("holdings lookthrough risk series", () => {
  it("produces daily returns from day-1 holdings weights", () => {
    const dates: string[] = [];
    const barsA: { date: string; close: number }[] = [];
    const barsB: { date: string; close: number }[] = [];
    let pa = 100;
    let pb = 50;
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.parse("2024-01-02T12:00:00.000Z") + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      dates.push(d);
      pa *= 1.01 + ((i % 5) - 2) * 0.004;
      pb *= 1.005 + ((i % 7) - 3) * 0.003;
      barsA.push({ date: d, close: pa });
      barsB.push({ date: d, close: pb });
    }
    const rets = buildHoldingsLookthroughDailyReturns({
      holdings: [
        { symbol: "A", marketValue: 70_000 },
        { symbol: "B", marketValue: 30_000 },
      ],
      barsBySymbol: new Map([
        ["A", barsA],
        ["B", barsB],
      ]),
      sampleDates: dates,
    });
    assert.ok(rets.length >= ANALYTICS_MIN_DAILY_OBS);
    const vol = computeAnnualizedVolatility(rets, "2024-02-01");
    assert.equal(vol.status, "available");
  });

  it("pickRiskReturnSeries uses lookthrough when ledger is short", () => {
    const ledger = buildFlowAwareDailyReturns(dailySeries(3, 0.001).marks, []);
    const look = buildFlowAwareDailyReturns(dailySeries(40, 0.001).marks, []);
    const picked = pickRiskReturnSeries({
      ledgerReturns: ledger,
      lookthroughReturns: look,
      minObs: ANALYTICS_MIN_DAILY_OBS,
    });
    assert.equal(picked.source, "lookthrough");
    assert.ok(picked.returns.length >= ANALYTICS_MIN_DAILY_OBS);
  });
});
