import assert from "node:assert/strict";
import test from "node:test";

import { isUsSecTenQTenKIssuer } from "./sec-earnings-us-filers.ts";

test("US 10-Q/10-K issuers stay eligible", () => {
  for (const ticker of [
    "AAPL",
    "MSFT",
    "NVDA",
    "WMT",
    "COST",
    "JPM",
    "HD",
    "CRM",
    "MRVL",
    "SNDK",
    "ALLY",
    "KEY",
    "BRK-B",
    "LIN",
    "ACN",
    "MDT",
    "ETN",
    "GEV",
  ]) {
    assert.equal(isUsSecTenQTenKIssuer({ ticker }), true, ticker);
  }
});

test("dry-run FPI/ADR zeros are excluded", () => {
  for (const ticker of ["TSM", "ASML", "TCEHY", "HSBC", "NVO", "ARM", "BABA", "RY", "SAP", "TM", "LVMHF"]) {
    assert.equal(isUsSecTenQTenKIssuer({ ticker }), false, ticker);
  }
});

test("OTC ADR patterns and Type/name ADR are excluded", () => {
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "BACHY" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "NSRGF" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "TSMWF" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "SHOP" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "FAKE", type: "ADR" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "FAKE", name: "Example Company ADR" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "PBR-A" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "RACE" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "TBB", name: "AT&T Inc. Notes" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "TBB" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "NCRRP" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "SOJE" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "GOOGL" }), true);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "AIIA-R" }), false);
  assert.equal(isUsSecTenQTenKIssuer({ ticker: "BRK-B" }), true);
});
