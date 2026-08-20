import assert from "node:assert/strict";
import test from "node:test";

import { pickKeyStatCellFromBundle } from "@/lib/screener/screener-key-stat-cell-pick";

test("pickKeyStatCellFromBundle returns row value or em dash", () => {
  const bundle = {
    basic: [{ label: "Market Cap", value: "$3T" }],
    valuation: null,
    revenueProfit: null,
    margins: null,
    growth: null,
    assetsLiabilities: null,
    returns: null,
    dividends: null,
    risk: null,
  };

  assert.equal(pickKeyStatCellFromBundle(bundle, "basic", "Market Cap"), "$3T");
  assert.equal(pickKeyStatCellFromBundle(bundle, "basic", "Employees"), "—");
  assert.equal(pickKeyStatCellFromBundle(bundle, "valuation", "P/E Ratio"), "—");
});
