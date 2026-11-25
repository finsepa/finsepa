/**
 * Run: npx tsx --test lib/portfolio/portfolio-winrate.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  buildPortfolioWinrateStats,
  formatWinratePercentLabel,
} from "@/lib/portfolio/portfolio-winrate";

function tx(
  partial: Partial<PortfolioTransaction> & Pick<PortfolioTransaction, "id" | "operation" | "symbol">,
): PortfolioTransaction {
  return {
    portfolioId: "p1",
    kind: "trade",
    name: partial.symbol,
    logoUrl: null,
    date: "2024-01-02",
    shares: 10,
    price: 100,
    fee: 0,
    sum: -1000,
    profitPct: null,
    profitUsd: null,
    ...partial,
  };
}

function openHolding(symbol: string, shares = 10): PortfolioHolding {
  return {
    id: `h-${symbol}`,
    symbol,
    name: symbol,
    logoUrl: null,
    shares,
    avgPrice: 100,
    costBasis: shares * 100,
    marketPrice: 110,
    currentValue: shares * 110,
  };
}

test("formatWinratePercentLabel rounds to integer percent", () => {
  assert.equal(formatWinratePercentLabel(0.666), "67%");
  assert.equal(formatWinratePercentLabel(0.5), "50%");
  assert.equal(formatWinratePercentLabel(0), "0%");
});

test("buildPortfolioWinrateStats classifies winners / losers like iOS", () => {
  const transactions: PortfolioTransaction[] = [
    // Winner: buy 10 @ 100, sell 10 @ 150 → +500
    tx({ id: "a1", operation: "Buy", symbol: "AAA", date: "2024-01-01", shares: 10, price: 100, sum: -1000 }),
    tx({
      id: "a2",
      operation: "Sell",
      symbol: "AAA",
      date: "2024-02-01",
      shares: 10,
      price: 150,
      sum: 1500,
    }),
    // Loser: buy 10 @ 100, sell 10 @ 80 → -200
    tx({ id: "b1", operation: "Buy", symbol: "BBB", date: "2024-01-01", shares: 10, price: 100, sum: -1000 }),
    tx({
      id: "b2",
      operation: "Sell",
      symbol: "BBB",
      date: "2024-02-01",
      shares: 10,
      price: 80,
      sum: 800,
    }),
    // Still open — ignored
    tx({ id: "c1", operation: "Buy", symbol: "CCC", date: "2024-01-01", shares: 5, price: 50, sum: -250 }),
  ];
  const holdings = [openHolding("CCC", 5)];
  const stats = buildPortfolioWinrateStats(holdings, transactions);

  assert.equal(stats.total, 2);
  assert.equal(stats.winners.length, 1);
  assert.equal(stats.losers.length, 1);
  assert.equal(stats.winners[0]!.symbol, "AAA");
  assert.equal(stats.losers[0]!.symbol, "BBB");
  assert.equal(stats.winShare, 0.5);
  assert.equal(formatWinratePercentLabel(stats.winShare), "50%");
  assert.ok(stats.winnersUsd > 0);
  assert.ok(stats.losersUsd < 0);
});

test("buildPortfolioWinrateStats is empty with no closed sells", () => {
  const stats = buildPortfolioWinrateStats(
    [openHolding("AAA")],
    [tx({ id: "1", operation: "Buy", symbol: "AAA", sum: -1000 })],
  );
  assert.equal(stats.isEmpty, true);
  assert.equal(stats.total, 0);
});
