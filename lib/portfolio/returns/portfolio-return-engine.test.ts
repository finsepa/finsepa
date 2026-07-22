/**
 * Phase 2 — Modified Dietz return engine tests (deterministic, no market data).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import {
  calendarDaysBetween,
  computeModifiedDietzReturn,
  dietzFromComponents,
  extractExternalCashFlows,
  modifiedDietzForNavWindow,
  modifiedDietzMidpointPct,
} from "./portfolio-return-engine.ts";

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

function trade(
  partial: Partial<PortfolioTransaction> &
    Pick<PortfolioTransaction, "id" | "operation" | "date" | "shares" | "price" | "sum">,
): PortfolioTransaction {
  return {
    portfolioId: "p1",
    kind: "trade",
    symbol: partial.symbol ?? "AAA",
    name: partial.name ?? partial.symbol ?? "AAA",
    logoUrl: null,
    fee: partial.fee ?? 0,
    profitPct: null,
    profitUsd: null,
    sequence: partial.sequence ?? 1,
    ...partial,
  };
}

function income(
  id: string,
  date: string,
  amount: number,
  symbol = "AAA",
): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "income",
    operation: "Dividend",
    symbol,
    name: symbol,
    logoUrl: null,
    date,
    shares: 0,
    price: 0,
    sum: amount,
    fee: 0,
    profitPct: null,
    profitUsd: null,
    sequence: 1,
  };
}

function expense(
  id: string,
  date: string,
  amount: number,
): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "expense",
    operation: "Fee",
    symbol: "USD",
    name: "Fee",
    logoUrl: null,
    date,
    shares: 0,
    price: 0,
    sum: -Math.abs(amount),
    fee: 0,
    profitPct: null,
    profitUsd: null,
    sequence: 1,
  };
}

describe("Modified Dietz core math", () => {
  it("A: deposit into unchanged portfolio → 0%", () => {
    // VB=0, deposit 100k mid-window, VE=100k
    const r = dietzFromComponents(0, 100_000, "2024-01-01", "2024-01-31", [
      { date: "2024-01-15", amount: 100_000 },
    ]);
    assert.equal(r.gainUsd, 0);
    assert.ok(r.pct != null && Math.abs(r.pct) < 1e-9);
  });

  it("B: withdrawal from unchanged portfolio → 0%", () => {
    // VB=100k, withdraw 40k, VE=60k
    const r = dietzFromComponents(100_000, 60_000, "2024-01-01", "2024-01-31", [
      { date: "2024-01-15", amount: -40_000 },
    ]);
    assert.equal(r.gainUsd, 0);
    assert.ok(r.pct != null && Math.abs(r.pct) < 1e-9);
  });

  it("C: deposit before gain — day-weighted Dietz", () => {
    // VB=100, deposit 100 on day 0 of 10-day window (weight=1), VE=220 → gain=20
    // denom = 100 + 100*1 = 200 → 10%
    const r = dietzFromComponents(100, 220, "2024-01-01", "2024-01-11", [
      { date: "2024-01-01", amount: 100 },
    ]);
    assert.equal(r.gainUsd, 20);
    assert.ok(r.pct != null);
    assert.ok(Math.abs(r.pct - 10) < 1e-6);
  });

  it("D: withdrawal after gain — day-weighted Dietz", () => {
    // VB=100, gain then withdraw 50 on last day (weight≈0), VE=70
    // netFlow=-50, gain=70-100-(-50)=20
    // denom ≈ 100 + (-50)*0 = 100 → 20%
    const r = dietzFromComponents(100, 70, "2024-01-01", "2024-01-11", [
      { date: "2024-01-11", amount: -50 },
    ]);
    assert.equal(r.gainUsd, 20);
    assert.ok(r.pct != null);
    assert.ok(Math.abs(r.pct - 20) < 1e-6);
  });

  it("E: multiple deposits", () => {
    const r = dietzFromComponents(0, 30_000, "2024-01-01", "2024-01-31", [
      { date: "2024-01-01", amount: 10_000 },
      { date: "2024-01-15", amount: 20_000 },
    ]);
    assert.equal(r.gainUsd, 0);
    assert.ok(r.pct != null && Math.abs(r.pct) < 1e-9);
  });

  it("F: multiple withdrawals", () => {
    const r = dietzFromComponents(50_000, 20_000, "2024-01-01", "2024-01-31", [
      { date: "2024-01-10", amount: -10_000 },
      { date: "2024-01-20", amount: -20_000 },
    ]);
    assert.equal(r.gainUsd, 0);
    assert.ok(r.pct != null && Math.abs(r.pct) < 1e-9);
  });

  it("midpoint approximation matches legacy helper", () => {
    const mid = modifiedDietzMidpointPct(100, 130, 20);
    // (130-100-20)/(100+10)=10/110
    assert.ok(mid != null);
    assert.ok(Math.abs(mid - (10 / 110) * 100) < 1e-9);
  });

  it("calendarDaysBetween handles weekends", () => {
    assert.equal(calendarDaysBetween("2024-01-05", "2024-01-08"), 3); // Fri→Mon
  });
});

describe("External cash flow extraction", () => {
  it("G: dividend only — not an external flow", () => {
    const txs = [
      cash("c1", "2024-01-01", 10_000),
      trade({ id: "b1", operation: "Buy", date: "2024-01-02", shares: 10, price: 100, sum: -1000 }),
      income("d1", "2024-01-15", 50),
    ];
    const flows = extractExternalCashFlows(txs, "2024-01-01", "2024-01-31");
    assert.equal(flows.length, 0);
  });

  it("H: fee only — not an external flow", () => {
    const txs = [
      cash("c1", "2024-01-01", 10_000),
      expense("e1", "2024-01-15", 25),
    ];
    const flows = extractExternalCashFlows(txs, "2024-01-01", "2024-01-31");
    assert.equal(flows.length, 0);
  });

  it("I: mixed stock + ETF + crypto — only Cash In/Out are flows", () => {
    const txs = [
      cash("c1", "2024-01-01", 50_000),
      trade({ id: "b1", operation: "Buy", date: "2024-01-02", symbol: "AAPL", shares: 10, price: 100, sum: -1000 }),
      trade({ id: "b2", operation: "Buy", date: "2024-01-03", symbol: "SPY", shares: 5, price: 400, sum: -2000 }),
      trade({ id: "b3", operation: "Buy", date: "2024-01-04", symbol: "BTC", shares: 0.1, price: 40_000, sum: -4000 }),
      cash("c2", "2024-01-20", -5_000),
      income("d1", "2024-01-25", 12),
    ];
    const flows = extractExternalCashFlows(txs, "2023-12-31", "2024-01-31");
    assert.equal(flows.length, 2);
    assert.equal(flows[0]!.amount, 50_000);
    assert.equal(flows[1]!.amount, -5_000);
  });

  it("J: historical transaction edit — flows follow ledger dates", () => {
    const before = [cash("c1", "2024-06-01", 10_000)];
    const afterEdit = [cash("c1", "2024-01-15", 10_000)]; // edited date
    const fBefore = extractExternalCashFlows(before, "2024-01-01", "2024-03-31");
    const fAfter = extractExternalCashFlows(afterEdit, "2024-01-01", "2024-03-31");
    assert.equal(fBefore.length, 0);
    assert.equal(fAfter.length, 1);
    assert.equal(fAfter[0]!.amount, 10_000);
  });
});

describe("Edge cases", () => {
  it("K: zero starting NAV", () => {
    const r = modifiedDietzForNavWindow({
      transactions: [cash("c1", "2024-01-10", 25_000)],
      vStart: 0,
      vEnd: 25_000,
      startYmd: "2024-01-01",
      endYmd: "2024-01-31",
    });
    assert.equal(r.gainUsd, 0);
    assert.ok(r.pct != null && Math.abs(r.pct) < 1e-9);
  });

  it("L: large portfolio — numeric stability", () => {
    const r = dietzFromComponents(50_000_000, 52_500_000, "2024-01-01", "2024-12-31", [
      { date: "2024-03-01", amount: 1_000_000 },
      { date: "2024-06-01", amount: -500_000 },
    ]);
    // gain = 52.5M - 50M - 0.5M = 2M
    assert.ok(r.gainUsd != null);
    assert.ok(Math.abs(r.gainUsd - 2_000_000) < 1e-3);
    assert.ok(r.pct != null && Number.isFinite(r.pct));
    assert.ok(r.pct > 0 && r.pct < 10);
  });

  it("independent textbook check: midpoint vs known example", () => {
    // Classic: VB=100, VE=120, CF=+10 mid → R=(120-100-10)/(100+5)=10/105
    const mid = modifiedDietzMidpointPct(100, 120, 10);
    assert.ok(mid != null);
    assert.ok(Math.abs(mid - (10 / 105) * 100) < 1e-9);

    // Day-weighted with CF exactly mid of 30-day month → weight 0.5
    const day = computeModifiedDietzReturn({
      vStart: 100,
      vEnd: 120,
      startYmd: "2024-01-01",
      endYmd: "2024-01-31",
      flows: [{ date: "2024-01-16", amount: 10 }],
    });
    assert.ok(day.pct != null);
    // days remaining from Jan 16 to Jan 31 = 15; CD=30; w=0.5
    assert.ok(Math.abs(day.pct - (10 / 105) * 100) < 1e-6);
  });

  it("naive V1/V0 would wrongly show +100% on deposit", () => {
    const v0 = 100_000;
    const v1 = 200_000;
    const naive = (v1 / v0 - 1) * 100;
    assert.equal(naive, 100);
    const dietz = dietzFromComponents(v0, v1, "2024-01-01", "2024-01-31", [
      { date: "2024-01-15", amount: 100_000 },
    ]);
    assert.ok(dietz.pct != null && Math.abs(dietz.pct) < 1e-9);
  });
});
