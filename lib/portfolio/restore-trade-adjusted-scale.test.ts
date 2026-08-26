import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import { restoreTradeToAdjustedCloseScale } from "./restore-trade-adjusted-scale.ts";

function buy(partial: Partial<PortfolioTransaction> & Pick<PortfolioTransaction, "shares" | "price">): PortfolioTransaction {
  const price = partial.price;
  const shares = partial.shares;
  return {
    id: partial.id ?? "tx1",
    portfolioId: partial.portfolioId ?? "p1",
    kind: "trade",
    operation: "Buy",
    symbol: partial.symbol ?? "NFLX",
    name: partial.name ?? "Netflix",
    logoUrl: null,
    date: partial.date ?? "2023-04-17",
    shares,
    price,
    fee: 0,
    sum: -(shares * price),
    profitPct: null,
    profitUsd: null,
  };
}

describe("restoreTradeToAdjustedCloseScale", () => {
  it("scales shares when rewriting NFLX as-traded fill to post-split continuous price", () => {
    // Demo-like fill near as-traded Apr 2023 close; EODHD adj reflects Nov 2025 10:1.
    const t = buy({ shares: 3.987241, price: 330 });
    const out = restoreTradeToAdjustedCloseScale(t, {
      close: 332.72,
      adjustedClose: 33.272,
    });
    assert.ok(out);
    assert.ok(Math.abs(out!.shares - 3.987241 * (332.72 / 33.272)) < 1e-4);
    assert.equal(out!.price, 33.272);
    // Cost basis preserved (± rounding).
    assert.ok(Math.abs(Math.abs(out!.sum) - Math.abs(t.sum)) / Math.abs(t.sum) < 0.02);
  });

  it("does not rewrite fills already on continuous scale", () => {
    const t = buy({ shares: 40, price: 33.272 });
    const out = restoreTradeToAdjustedCloseScale(t, {
      close: 332.72,
      adjustedClose: 33.272,
    });
    assert.equal(out, null);
  });
});
