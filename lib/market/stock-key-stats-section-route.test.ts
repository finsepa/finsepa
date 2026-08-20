import assert from "node:assert/strict";
import test from "node:test";

import { keyStatsSectionFromRouteSegment } from "@/lib/market/stock-key-stats-bundle-types";

test("keyStatsSectionFromRouteSegment maps all nine section routes", () => {
  assert.equal(keyStatsSectionFromRouteSegment("basic"), "basic");
  assert.equal(keyStatsSectionFromRouteSegment("valuation"), "valuation");
  assert.equal(keyStatsSectionFromRouteSegment("revenue-profit"), "revenueProfit");
  assert.equal(keyStatsSectionFromRouteSegment("margins"), "margins");
  assert.equal(keyStatsSectionFromRouteSegment("growth"), "growth");
  assert.equal(keyStatsSectionFromRouteSegment("assets-liabilities"), "assetsLiabilities");
  assert.equal(keyStatsSectionFromRouteSegment("returns"), "returns");
  assert.equal(keyStatsSectionFromRouteSegment("dividends"), "dividends");
  assert.equal(keyStatsSectionFromRouteSegment("risk"), "risk");
  assert.equal(keyStatsSectionFromRouteSegment("unknown"), null);
});
