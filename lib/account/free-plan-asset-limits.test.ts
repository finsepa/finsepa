import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countUniqueOpenHoldingSymbols,
  findFreeHoldingsPersistViolation,
  FREE_HOLDINGS_LIMIT_CODE,
  FREE_WATCHLIST_ASSET_LIMIT_CODE,
  freeHoldingsLimitMessage,
  freeWatchlistAssetLimitMessage,
  uniqueOpenHoldingSymbols,
  wouldExceedFreeHoldingsCap,
  wouldExceedFreeWatchlistAssetCap,
} from "./free-plan-asset-limits.ts";
import {
  entitlementsForTier,
  FREE_MAX_HOLDINGS_PER_PORTFOLIO,
  FREE_MAX_WATCHLIST_ASSETS,
} from "./plan-entitlements.ts";
import { FREE_PLAN_CARD_FEATURES, PRO_PLAN_CARD_FEATURES } from "./plan-comparison.ts";

describe("Free plan asset entitlements", () => {
  it("exposes 15 holdings / 15 watchlist assets on Free and unlimited on Pro", () => {
    const free = entitlementsForTier("free");
    assert.equal(free.maxHoldingsPerPortfolio, FREE_MAX_HOLDINGS_PER_PORTFOLIO);
    assert.equal(free.maxWatchlistAssets, FREE_MAX_WATCHLIST_ASSETS);
    assert.equal(free.maxHoldingsPerPortfolio, 15);
    assert.equal(free.maxWatchlistAssets, 15);

    const pro = entitlementsForTier("pro");
    assert.equal(pro.maxHoldingsPerPortfolio, null);
    assert.equal(pro.maxWatchlistAssets, null);
  });

  it("documents Free Demo + holdings caps in plan comparison copy", () => {
    assert.ok(FREE_PLAN_CARD_FEATURES.some((f) => f === "Demo + 1 manual portfolio"));
    assert.ok(FREE_PLAN_CARD_FEATURES.some((f) => f === "Up to 15 holdings"));
    assert.ok(PRO_PLAN_CARD_FEATURES.some((f) => f === "Unlimited holdings"));
  });
});

describe("countUniqueOpenHoldingSymbols", () => {
  it("counts unique open symbols and ignores closed / empty", () => {
    assert.equal(
      countUniqueOpenHoldingSymbols([
        { symbol: "AAPL", shares: 10 },
        { symbol: "aapl", shares: 2 },
        { symbol: "MSFT", shares: 0 },
        { symbol: "BTC", shares: 0.01 },
        { symbol: "  ", shares: 5 },
      ]),
      2,
    );
    assert.equal(countUniqueOpenHoldingSymbols([]), 0);
    assert.equal(countUniqueOpenHoldingSymbols(null), 0);
  });
});

describe("wouldExceedFreeHoldingsCap", () => {
  const holdings = Array.from({ length: 15 }, (_, i) => ({
    symbol: `T${i}`,
    shares: 1,
  }));

  it("blocks a new 16th symbol on Free", () => {
    assert.equal(
      wouldExceedFreeHoldingsCap({ holdings, symbol: "NEW" }),
      true,
    );
  });

  it("allows buys of an existing open symbol at cap", () => {
    assert.equal(
      wouldExceedFreeHoldingsCap({ holdings, symbol: "T0" }),
      false,
    );
  });

  it("allows new symbols under the cap", () => {
    assert.equal(
      wouldExceedFreeHoldingsCap({
        holdings: holdings.slice(0, 14),
        symbol: "NEW",
      }),
      false,
    );
  });

  it("never exceeds when max is null (Pro)", () => {
    assert.equal(
      wouldExceedFreeHoldingsCap({ holdings, symbol: "NEW", maxHoldings: null }),
      false,
    );
  });
});

describe("findFreeHoldingsPersistViolation (Pro→Free grandfather)", () => {
  const manual = { id: "p1", name: "Main", kind: "manual" as const };
  const brokerage = {
    id: "p2",
    name: "Broker",
    kind: "manual" as const,
    snaptrade: { authorizationId: "x" },
  };

  it("rejects growth past 15 on a manual portfolio", () => {
    const previousHoldings = {
      p1: Array.from({ length: 15 }, (_, i) => ({ symbol: `T${i}`, shares: 1 })),
    };
    const nextHoldings = {
      p1: [...previousHoldings.p1, { symbol: "NEW", shares: 1 }],
    };
    const v = findFreeHoldingsPersistViolation({
      portfolios: [manual],
      nextHoldingsByPortfolioId: nextHoldings,
      previousHoldingsByPortfolioId: previousHoldings,
      maxHoldings: 15,
    });
    assert.ok(v);
    assert.equal(v!.portfolioId, "p1");
    assert.equal(v!.nextCount, 16);
    assert.equal(v!.prevCount, 15);
  });

  it("allows over-cap persist when count does not increase (grandfather)", () => {
    const holdings = Array.from({ length: 20 }, (_, i) => ({
      symbol: `T${i}`,
      shares: 1,
    }));
    const v = findFreeHoldingsPersistViolation({
      portfolios: [manual],
      nextHoldingsByPortfolioId: { p1: holdings },
      previousHoldingsByPortfolioId: { p1: holdings },
      maxHoldings: 15,
    });
    assert.equal(v, null);
  });

  it("allows reducing an over-cap book toward the Free limit", () => {
    const previous = Array.from({ length: 20 }, (_, i) => ({
      symbol: `T${i}`,
      shares: 1,
    }));
    const next = previous.slice(0, 18);
    const v = findFreeHoldingsPersistViolation({
      portfolios: [manual],
      nextHoldingsByPortfolioId: { p1: next },
      previousHoldingsByPortfolioId: { p1: previous },
      maxHoldings: 15,
    });
    assert.equal(v, null);
  });

  it("ignores brokerage portfolios for Free holdings cap", () => {
    const next = Array.from({ length: 40 }, (_, i) => ({
      symbol: `B${i}`,
      shares: 1,
    }));
    const v = findFreeHoldingsPersistViolation({
      portfolios: [brokerage],
      nextHoldingsByPortfolioId: { p2: next },
      previousHoldingsByPortfolioId: { p2: [] },
      maxHoldings: 15,
    });
    assert.equal(v, null);
  });

  it("rejects first write that lands above 15 with no previous row", () => {
    const next = Array.from({ length: 16 }, (_, i) => ({
      symbol: `T${i}`,
      shares: 1,
    }));
    const v = findFreeHoldingsPersistViolation({
      portfolios: [manual],
      nextHoldingsByPortfolioId: { p1: next },
      previousHoldingsByPortfolioId: null,
      maxHoldings: 15,
    });
    assert.ok(v);
    assert.equal(v!.prevCount, 0);
    assert.equal(v!.nextCount, 16);
  });
});

describe("wouldExceedFreeWatchlistAssetCap", () => {
  it("blocks new ticker at 15", () => {
    assert.equal(
      wouldExceedFreeWatchlistAssetCap({
        currentTickerCount: 15,
        tickerAlreadyPresent: false,
      }),
      true,
    );
  });

  it("allows duplicate ticker at 15", () => {
    assert.equal(
      wouldExceedFreeWatchlistAssetCap({
        currentTickerCount: 15,
        tickerAlreadyPresent: true,
      }),
      false,
    );
  });

  it("allows under cap", () => {
    assert.equal(
      wouldExceedFreeWatchlistAssetCap({
        currentTickerCount: 14,
        tickerAlreadyPresent: false,
      }),
      false,
    );
  });
});

describe("limit messages and codes", () => {
  it("keeps stable API codes for clients", () => {
    assert.equal(FREE_HOLDINGS_LIMIT_CODE, "FREE_HOLDINGS_LIMIT");
    assert.equal(FREE_WATCHLIST_ASSET_LIMIT_CODE, "FREE_WATCHLIST_ASSET_LIMIT");
    assert.match(freeHoldingsLimitMessage(15), /15 assets per portfolio/);
    assert.match(freeWatchlistAssetLimitMessage(15), /15 assets per watchlist/);
  });

  it("uniqueOpenHoldingSymbols matches count", () => {
    const holdings = [
      { symbol: "A", shares: 1 },
      { symbol: "B", shares: 0 },
      { symbol: "C", shares: 2 },
    ];
    assert.equal(uniqueOpenHoldingSymbols(holdings).size, countUniqueOpenHoldingSymbols(holdings));
  });
});
