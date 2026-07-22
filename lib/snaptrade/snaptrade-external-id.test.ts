/**
 * Phase 5B — SnapTrade external identity (deterministic, full-precision) tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  snaptradeActivityExternalId,
  snaptradeAdjustmentExternalId,
  snaptradeFallbackExternalId,
  snaptradeOrderExternalId,
} from "./snaptrade-external-id.ts";

describe("snaptrade external ids — provider ids", () => {
  it("activity id is namespaced and deterministic", () => {
    const id = snaptradeActivityExternalId("acct-1", "act-99");
    assert.equal(id, "snaptrade:activity:acct-1:act-99");
    assert.equal(id, snaptradeActivityExternalId("acct-1", "act-99"));
  });

  it("order id is namespaced and distinct from activity id", () => {
    assert.equal(snaptradeOrderExternalId("acct-1", "o-5"), "snaptrade:order:acct-1:o-5");
    assert.notEqual(
      snaptradeOrderExternalId("acct-1", "5"),
      snaptradeActivityExternalId("acct-1", "5"),
    );
  });

  it("trims surrounding whitespace on inputs", () => {
    assert.equal(snaptradeActivityExternalId("  acct-1 ", " act-99 "), "snaptrade:activity:acct-1:act-99");
  });
});

describe("snaptrade external ids — fallback hash", () => {
  it("is deterministic for identical field sets (order independent)", () => {
    const a = snaptradeFallbackExternalId("acct", { date: "2024-01-02", symbol: "AAPL", units: 3, price: 100.5 });
    const b = snaptradeFallbackExternalId("acct", { price: 100.5, units: 3, symbol: "AAPL", date: "2024-01-02" });
    assert.equal(a, b);
  });

  it("preserves FULL precision — tiny share/price differences produce different ids", () => {
    const a = snaptradeFallbackExternalId("acct", { units: 1.000001, price: 10 });
    const b = snaptradeFallbackExternalId("acct", { units: 1.000002, price: 10 });
    assert.notEqual(a, b, "must not round shares to 4dp");

    const c = snaptradeFallbackExternalId("acct", { units: 1, price: 10.001 });
    const d = snaptradeFallbackExternalId("acct", { units: 1, price: 10.002 });
    assert.notEqual(c, d, "must not round price to 2dp");
  });

  it("is namespaced", () => {
    assert.match(snaptradeFallbackExternalId("acct", { x: 1 }), /^snaptrade:fallback:acct:/);
  });
});

describe("snaptrade external ids — adjustments", () => {
  it("is stable across syncs for the same symbol (so merge upserts, not duplicates)", () => {
    const a = snaptradeAdjustmentExternalId("acct", "holding", "aapl");
    const b = snaptradeAdjustmentExternalId("acct", "holding", "AAPL");
    assert.equal(a, b, "symbol key is case-insensitive");
    assert.equal(a, "snaptrade:adjust:acct:holding:AAPL");
  });

  it("distinguishes adjustment kinds", () => {
    assert.notEqual(
      snaptradeAdjustmentExternalId("acct", "holding", "USD"),
      snaptradeAdjustmentExternalId("acct", "cash", "USD"),
    );
  });
});
