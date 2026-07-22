/**
 * Order fill gate + normalize order — never import Alpaca NEW / unfilled.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSnaptradeOrderFillEligible } from "./snaptrade-order-fill-gate.ts";
import {
  normalizeSnaptradeOrder,
  type SnapTradeNormalizeContext,
} from "./snaptrade-normalize-activity.ts";

const ctx: SnapTradeNormalizeContext = {
  accountId: "acct-1",
  authorizationId: "auth-1",
  syncTimestamp: "2026-07-22T12:00:00.000Z",
};

describe("isSnaptradeOrderFillEligible", () => {
  it("rejects NEW / PENDING even when total size is present", () => {
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "NEW", filledQuantity: 0 }),
      false,
    );
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "PENDING", filledQuantity: 0 }),
      false,
    );
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "ACCEPTED", filledQuantity: 0 }),
      false,
    );
  });

  it("rejects open statuses even if filled_quantity is wrongly non-zero", () => {
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "NEW", filledQuantity: 15 }),
      false,
    );
  });

  it("accepts EXECUTED / FILLED / PARTIAL with positive fill", () => {
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "EXECUTED", filledQuantity: 0.05 }),
      true,
    );
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "FILLED", filledQuantity: 2 }),
      true,
    );
    assert.equal(
      isSnaptradeOrderFillEligible({ status: "PARTIAL", filledQuantity: 1 }),
      true,
    );
  });
});

describe("normalizeSnaptradeOrder ignores unfilled", () => {
  it("skips Alpaca-style NEW order (Jul 22 SPGI / META / GLXY open)", () => {
    const { draft, warning } = normalizeSnaptradeOrder(
      {
        status: "NEW",
        action: "BUY",
        total_quantity: 15,
        filled_quantity: 0,
        execution_price: null,
        time_placed: "2026-07-22T12:26:48.000Z",
        universal_symbol: { symbol: "SPGI", description: "S&P Global" },
      },
      ctx,
      "2026-07-22",
    );
    assert.equal(draft, null);
    assert.equal(warning, null);
  });

  it("imports EXECUTED fill with filled_quantity only", () => {
    const { draft, warning } = normalizeSnaptradeOrder(
      {
        status: "EXECUTED",
        action: "BUY",
        total_quantity: 0.05,
        filled_quantity: 0.05,
        execution_price: 65864.736,
        time_executed: "2026-07-22T12:29:33.000Z",
        universal_symbol: { symbol: "BTCUSD", description: "Bitcoin" },
        brokerage_order_id: "btc-1",
      },
      ctx,
      "2026-07-22",
    );
    assert.equal(warning, null);
    assert.ok(draft);
    assert.equal(draft.symbol, "BTC");
    assert.equal(draft.shares, 0.05);
    assert.equal(draft.kind, "trade");
  });

  it("does not fall back to total_quantity when filled is zero", () => {
    const { draft } = normalizeSnaptradeOrder(
      {
        status: "EXECUTED",
        action: "BUY",
        total_quantity: 20,
        filled_quantity: 0,
        execution_price: 100,
        universal_symbol: { symbol: "META" },
        brokerage_order_id: "meta-1",
      },
      ctx,
      "2026-07-22",
    );
    assert.equal(draft, null);
  });
});
