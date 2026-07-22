/**
 * SnapTrade crypto symbol + order/activity dedupe — Connected sync PASS gates.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toSupportedCryptoTicker } from "../market/crypto-meta.ts";
import {
  canonicalizeSnaptradeSymbol,
  normalizeSnaptradeCryptoSymbol,
} from "./snaptrade-crypto-symbol.ts";
import {
  dedupeSnaptradeOrdersAgainstActivities,
  snaptradeTradeDedupeKey,
} from "./snaptrade-order-activity-dedupe.ts";
import {
  normalizeSnaptradeActivity,
  symbolFromPosition,
  type SnapTradeNormalizeContext,
} from "./snaptrade-normalize-activity.ts";
import type { SnapTradeSyncDraftTransaction } from "./snaptrade-normalize-activity.ts";

const ctx: SnapTradeNormalizeContext = {
  accountId: "acct-1",
  authorizationId: "auth-1",
  syncTimestamp: "2026-07-22T12:00:00.000Z",
};

function trade(
  partial: Partial<SnapTradeSyncDraftTransaction> &
    Pick<SnapTradeSyncDraftTransaction, "date" | "operation" | "symbol" | "shares" | "price">,
): SnapTradeSyncDraftTransaction {
  const isBuy = partial.operation.toLowerCase() === "buy";
  const sum = partial.sum ?? (isBuy ? -(partial.shares * partial.price) : partial.shares * partial.price);
  return {
    kind: "trade",
    name: partial.symbol,
    logoUrl: null,
    fee: 0,
    profitPct: null,
    profitUsd: null,
    sum,
    ...partial,
  };
}

describe("normalizeSnaptradeCryptoSymbol", () => {
  it("maps Alpaca-style BTCUSD / ETHUSD to Finsepa bases", () => {
    assert.deepEqual(normalizeSnaptradeCryptoSymbol("BTCUSD"), {
      symbol: "BTC",
      name: "Bitcoin",
    });
    assert.deepEqual(normalizeSnaptradeCryptoSymbol("ETHUSD"), {
      symbol: "ETH",
      name: "Ethereum",
    });
  });

  it("maps hyphen pairs and leaves equities alone", () => {
    assert.equal(normalizeSnaptradeCryptoSymbol("BTC-USD")?.symbol, "BTC");
    assert.equal(normalizeSnaptradeCryptoSymbol("GLXY"), null);
    assert.equal(normalizeSnaptradeCryptoSymbol("RACE"), null);
  });

  it("canonicalizeSnaptradeSymbol keeps equity tickers", () => {
    assert.deepEqual(canonicalizeSnaptradeSymbol("GLXY.US"), {
      symbol: "GLXY",
      name: "GLXY",
    });
  });
});

describe("symbolFromPosition crypto", () => {
  it("normalizes instrument BTCUSD without universal type", () => {
    const sym = symbolFromPosition({ symbol: "BTCUSD", units: 0.1, price: 65000 });
    assert.ok(sym);
    assert.equal(sym.symbol, "BTC");
  });
});

describe("normalizeSnaptradeActivity crypto buy", () => {
  it("stores BTC not BTCUSD", () => {
    const { draft, warning } = normalizeSnaptradeActivity(
      {
        type: "BUY",
        trade_date: "2026-01-10T00:00:00.000Z",
        units: 0.149625,
        price: 22000,
        amount: -3291.75,
        universal_symbol: { symbol: "BTCUSD", description: "Bitcoin" },
      },
      ctx,
    );
    assert.equal(warning, null);
    assert.ok(draft);
    assert.equal(draft.symbol, "BTC");
    assert.equal(draft.kind, "trade");
  });
});

describe("toSupportedCryptoTicker concatenated", () => {
  it("resolves BTCUSD for quote / EOD routing", () => {
    assert.equal(toSupportedCryptoTicker("BTCUSD"), "BTC");
    assert.equal(toSupportedCryptoTicker("ETHUSDT"), "ETH");
  });
});

describe("dedupeSnaptradeOrdersAgainstActivities", () => {
  it("drops orders that match activity fills", () => {
    const activities = [
      trade({ date: "2026-06-01", operation: "Buy", symbol: "RACE", shares: 25, price: 350 }),
    ];
    const orders = [
      trade({ date: "2026-06-01", operation: "Buy", symbol: "RACE", shares: 25, price: 350 }),
      trade({ date: "2026-06-02", operation: "Buy", symbol: "GLXY", shares: 100, price: 30 }),
    ];
    const { kept, dropped } = dedupeSnaptradeOrdersAgainstActivities(activities, orders);
    assert.equal(dropped, 1);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.symbol, "GLXY");
  });

  it("trade dedupe key is full precision", () => {
    const a = trade({
      date: "2026-01-01",
      operation: "Buy",
      symbol: "BTC",
      shares: 0.149625,
      price: 65850.1,
    });
    const b = trade({
      date: "2026-01-01",
      operation: "Buy",
      symbol: "BTC",
      shares: 0.149625,
      price: 65850.1,
    });
    assert.equal(snaptradeTradeDedupeKey(a), snaptradeTradeDedupeKey(b));
  });
});
