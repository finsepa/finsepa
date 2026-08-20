import assert from "node:assert/strict";
import test from "node:test";

import { parseScreenerCompaniesKeyStatRequest } from "@/lib/screener/screener-companies-key-stat-request";

test("parseScreenerCompaniesKeyStatRequest accepts metricIds batch", () => {
  const result = parseScreenerCompaniesKeyStatRequest({
    tickers: ["aapl", "MSFT", "aapl"],
    metricIds: ["val-pe-ratio", "rp-revenue"],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.parsed.mode, "batch");
  if (result.parsed.mode !== "batch") return;
  assert.deepEqual(result.parsed.tickers, ["AAPL", "MSFT"]);
  assert.deepEqual(result.parsed.metricIds, ["val-pe-ratio", "rp-revenue"]);
});

test("parseScreenerCompaniesKeyStatRequest accepts legacy metricId", () => {
  const result = parseScreenerCompaniesKeyStatRequest({
    tickers: ["NVDA"],
    metricId: "mg-gross",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.parsed.mode, "legacy");
  if (result.parsed.mode !== "legacy") return;
  assert.equal(result.parsed.metric.id, "mg-gross");
});

test("parseScreenerCompaniesKeyStatRequest rejects unknown metric", () => {
  const result = parseScreenerCompaniesKeyStatRequest({
    tickers: ["AAPL"],
    metricIds: ["not-a-metric"],
  });
  assert.equal(result.ok, false);
});
