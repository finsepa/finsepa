/**
 * Connected-broker cash mapping + NAV bridge helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cashBridgeNote,
  openingCashBridgeDate,
} from "./snaptrade-cash-bridge.ts";
import {
  classifySnaptradeCashActivityType,
  normalizeSnaptradeActivity,
  type SnapTradeNormalizeContext,
} from "./snaptrade-normalize-activity.ts";

const ctx: SnapTradeNormalizeContext = {
  accountId: "acct-1",
  authorizationId: "auth-1",
  syncTimestamp: "2026-07-22T12:00:00.000Z",
};

describe("classifySnaptradeCashActivityType", () => {
  it("maps classic deposit / withdraw labels", () => {
    assert.equal(classifySnaptradeCashActivityType("DEPOSIT", false), "in");
    assert.equal(classifySnaptradeCashActivityType("CONTRIBUTION", false), "in");
    assert.equal(classifySnaptradeCashActivityType("WITHDRAWAL", false), "out");
  });

  it("maps Alpaca-style ACH / WIRE / FUNDING / JNLC", () => {
    assert.equal(classifySnaptradeCashActivityType("ACH", false), "in");
    assert.equal(classifySnaptradeCashActivityType("ACH_OUT", false), "out");
    assert.equal(classifySnaptradeCashActivityType("WIRE", false), "in");
    assert.equal(classifySnaptradeCashActivityType("FUNDING", false), "in");
    assert.equal(classifySnaptradeCashActivityType("JNLC", false), "in");
    assert.equal(classifySnaptradeCashActivityType("CSD", false), "in");
    assert.equal(classifySnaptradeCashActivityType("CSW", false), "out");
  });

  it("treats CASH and cash TRANSFER as signed", () => {
    assert.equal(classifySnaptradeCashActivityType("CASH", false), "signed");
    assert.equal(classifySnaptradeCashActivityType("TRANSFER", false), "signed");
    assert.equal(classifySnaptradeCashActivityType("TRANSFER", true), null);
  });
});

describe("normalizeSnaptradeActivity cash mapping", () => {
  it("imports ACH funding as Cash In", () => {
    const { draft, warning } = normalizeSnaptradeActivity(
      {
        type: "ACH",
        trade_date: "2026-01-15T00:00:00.000Z",
        amount: 50_000,
      },
      ctx,
    );
    assert.equal(warning, null);
    assert.ok(draft);
    assert.equal(draft.kind, "cash");
    assert.equal(draft.operation, "Cash In");
    assert.equal(draft.sum, 50_000);
  });
});

describe("openingCashBridgeDate", () => {
  it("returns day before earliest activity", () => {
    assert.equal(
      openingCashBridgeDate(
        [
          {
            kind: "trade",
            operation: "Buy",
            symbol: "AAPL",
            name: "Apple",
            logoUrl: null,
            date: "2026-06-10",
            shares: 1,
            price: 100,
            fee: 0,
            sum: -100,
            profitPct: null,
            profitUsd: null,
          },
        ],
        "2026-07-22",
      ),
      "2026-06-09",
    );
  });

  it("cashBridgeNote mentions missing funding", () => {
    assert.match(cashBridgeNote(1000, -500), /Funding activity was missing/);
  });
});
