/**
 * Phase 3 — contribution-model benchmark integrity tests (deterministic).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import {
  benchmarkNavOnDate,
  comparePortfolioToBenchmark,
  extractAllExternalCashFlows,
  replayBenchmarkSharesAsOf,
} from "./benchmark-engine.ts";

function cash(
  id: string,
  date: string,
  amount: number,
  sequence = 1,
): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "cash",
    operation: amount >= 0 ? "Cash In" : "Cash Out",
    symbol: "USD",
    name: "USD",
    logoUrl: null,
    date,
    shares: Math.abs(amount),
    price: 1,
    sum: amount,
    fee: 0,
    profitPct: null,
    profitUsd: null,
    sequence,
  };
}

/** Flat price book: constant mark → contribution NAV = net deposits. */
function flatPrice(level: number): (ymd: string) => number {
  return () => level;
}

/** Rising / falling linear price path keyed by date. */
function priceBook(map: Record<string, number>): (ymd: string) => number | null {
  const dates = Object.keys(map).sort();
  return (ymd: string) => {
    let ans: number | null = null;
    for (const d of dates) {
      if (d <= ymd) ans = map[d]!;
      else break;
    }
    return ans;
  };
}

describe("contribution benchmark replay", () => {
  it("D: deposit buys shares same day", () => {
    const flows = extractAllExternalCashFlows([cash("c1", "2024-01-10", 10_000)]);
    const shares = replayBenchmarkSharesAsOf(flows, "2024-01-10", flatPrice(100));
    assert.equal(shares, 100);
    assert.equal(benchmarkNavOnDate(flows, "2024-01-10", flatPrice(100)), 10_000);
  });

  it("E: withdrawal sells shares same day", () => {
    const flows = extractAllExternalCashFlows([
      cash("c1", "2024-01-01", 10_000),
      cash("c2", "2024-01-15", -2_000),
    ]);
    const px = flatPrice(100);
    assert.equal(benchmarkNavOnDate(flows, "2024-01-14", px), 10_000);
    assert.equal(benchmarkNavOnDate(flows, "2024-01-15", px), 8_000);
  });

  it("I: multiple cash flows accumulate shares", () => {
    const flows = extractAllExternalCashFlows([
      cash("c1", "2024-01-01", 10_000, 1),
      cash("c2", "2024-03-15", 2_000, 2),
      cash("c3", "2024-05-01", -500, 3),
    ]);
    const px = flatPrice(50);
    // 10000/50 + 2000/50 - 500/50 = 200 + 40 - 10 = 230
    assert.equal(replayBenchmarkSharesAsOf(flows, "2024-05-01", px), 230);
    assert.equal(benchmarkNavOnDate(flows, "2024-05-01", px), 11_500);
  });
});

describe("Ahead vs contribution Dietz", () => {
  it("A: portfolio exactly tracks benchmark → Ahead ≈ 0", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-06-01": 110,
      "2024-12-31": 120,
    });
    // Portfolio NAV mirrors benchmark: deposit 10k at 100 → 100 shares → end 12k
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 12_000,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.portfolioPct != null);
    assert.ok(compare.benchmarkPct != null);
    assert.ok(compare.aheadPct != null);
    assert.ok(Math.abs(compare.aheadPct) < 1e-6);
    assert.ok(Math.abs(compare.portfolioPct - compare.benchmarkPct) < 1e-6);
  });

  it("B: portfolio outperforms → positive Ahead", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-12-31": 110, // bench +10%
    });
    // Portfolio ends at 13k (+30% Dietz-ish) while bench ends 11k
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 13_000,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.aheadPct != null && compare.aheadPct > 0);
  });

  it("C: portfolio underperforms → negative Ahead", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-12-31": 120,
    });
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 10_500,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.aheadPct != null && compare.aheadPct < 0);
  });

  it("F: flat market → both ~0% when portfolio flat", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = flatPrice(100);
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 10_000,
      startYmd: "2023-12-31",
      endYmd: "2024-06-30",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.portfolioPct != null && Math.abs(compare.portfolioPct) < 1e-6);
    assert.ok(compare.benchmarkPct != null && Math.abs(compare.benchmarkPct) < 1e-6);
    assert.ok(compare.aheadPct != null && Math.abs(compare.aheadPct) < 1e-6);
  });

  it("G: bear market — benchmark negative, matched portfolio tracks", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-12-31": 80,
    });
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 8_000,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.benchmarkPct != null && compare.benchmarkPct < 0);
    assert.ok(compare.aheadPct != null && Math.abs(compare.aheadPct) < 1e-6);
  });

  it("H: bull market — benchmark positive", () => {
    const txs = [cash("c1", "2024-01-01", 10_000)];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-12-31": 150,
    });
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 15_000,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.benchmarkPct != null && compare.benchmarkPct > 0);
    assert.ok(compare.aheadPct != null && Math.abs(compare.aheadPct) < 1e-6);
  });

  it("J: large portfolio numeric stability", () => {
    const txs = [
      cash("c1", "2024-01-01", 50_000_000),
      cash("c2", "2024-06-01", 5_000_000),
    ];
    const prices = priceBook({
      "2024-01-01": 400,
      "2024-06-01": 420,
      "2024-12-31": 440,
    });
    const benchEnd = benchmarkNavOnDate(extractAllExternalCashFlows(txs), "2024-12-31", prices);
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: benchEnd,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.aheadPct != null && Math.abs(compare.aheadPct) < 1e-4);
    assert.ok(compare.portfolioPct != null && Number.isFinite(compare.portfolioPct));
  });

  it("same methodology: both use Modified Dietz (not price-only vs Dietz)", () => {
    const txs = [
      cash("c1", "2024-01-01", 10_000),
      cash("c2", "2024-07-01", 10_000),
    ];
    const prices = priceBook({
      "2024-01-01": 100,
      "2024-07-01": 100,
      "2024-12-31": 100,
    });
    // Naive SPY price return = 0%; Dietz with two deposits also 0% if flat.
    const compare = comparePortfolioToBenchmark({
      transactions: txs,
      portfolioVStart: 0,
      portfolioVEnd: 20_000,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: prices,
    });
    assert.ok(compare.portfolioPct != null && Math.abs(compare.portfolioPct) < 1e-6);
    assert.ok(compare.benchmarkPct != null && Math.abs(compare.benchmarkPct) < 1e-6);
    // Price-only on SPY is also 0 here; deposit mid-year must not create false Ahead.
    assert.ok(compare.aheadPct != null && Math.abs(compare.aheadPct) < 1e-6);
  });

  it("no cash flows → benchmarkPct null (not fake 0%)", () => {
    const compare = comparePortfolioToBenchmark({
      transactions: [],
      portfolioVStart: 0,
      portfolioVEnd: 0,
      startYmd: "2023-12-31",
      endYmd: "2024-12-31",
      priceOnOrBefore: flatPrice(100),
    });
    assert.equal(compare.benchmarkPct, null);
    assert.equal(compare.aheadPct, null);
  });
});
