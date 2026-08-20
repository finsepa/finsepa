import assert from "node:assert/strict";
import test from "node:test";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  portfolioValueHistoryCacheKey,
  portfolioValueHistoryLedgerKey,
} from "@/lib/portfolio/portfolio-value-history-client-cache";

function tx(id: string, sum: number): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "trade",
    operation: "Buy",
    symbol: "AAPL",
    name: "Apple",
    logoUrl: null,
    date: "2026-01-01",
    shares: 1,
    price: 100,
    fee: 0,
    sum,
    profitPct: null,
    profitUsd: null,
  };
}

test("portfolioValueHistoryLedgerKey is stable and order-independent", () => {
  const a = portfolioValueHistoryLedgerKey([tx("b", 100), tx("a", 200)]);
  const b = portfolioValueHistoryLedgerKey([tx("a", 200), tx("b", 100)]);
  assert.equal(a, b);
  assert.notEqual(a, portfolioValueHistoryLedgerKey([tx("a", 200)]));
});

test("portfolioValueHistoryCacheKey includes range", () => {
  const ledger = [tx("a", 100)];
  assert.notEqual(
    portfolioValueHistoryCacheKey("ytd", ledger),
    portfolioValueHistoryCacheKey("6m", ledger),
  );
});
