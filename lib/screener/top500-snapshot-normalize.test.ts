/**
 * Run: npx tsx --test lib/screener/top500-snapshot-normalize.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  filterScreenerTop500ExcludedTickers,
  normalizeTop500SnapshotRows,
  type TopCompanyUniverseRow,
} from "./top500-snapshot-normalize";

function row(ticker: string, marketCapUsd = 1e9): TopCompanyUniverseRow {
  return {
    ticker,
    name: ticker,
    exchange: "US",
    sector: null,
    industry: null,
    marketCapUsd,
    adjustedClose: null,
    refund1dP: null,
    refund5dP: null,
    refund1mP: null,
    refundYtdP: null,
    closes5d: null,
    earningsShare: null,
  };
}

test("filterScreenerTop500ExcludedTickers drops GOOG and SKHY ADRs", () => {
  const out = filterScreenerTop500ExcludedTickers([
    row("AAPL"),
    row("GOOG"),
    row("GOOGL"),
    row("SKHY"),
    row("SKHYY"),
  ]);
  assert.deepEqual(
    out.map((r) => r.ticker),
    ["AAPL", "GOOGL"],
  );
});

test("normalizeTop500SnapshotRows rejects empty and tiny blobs", () => {
  assert.equal(normalizeTop500SnapshotRows(null), null);
  assert.equal(normalizeTop500SnapshotRows([]), null);
  assert.equal(normalizeTop500SnapshotRows([row("AAPL")]), null);
});

test("normalizeTop500SnapshotRows accepts a usable snapshot and applies exclusions", () => {
  const rows = Array.from({ length: 120 }, (_, i) => row(`T${i}`));
  rows[0] = row("GOOG");
  const normalized = normalizeTop500SnapshotRows(rows);
  assert.ok(normalized);
  assert.equal(normalized!.length, 119);
  assert.ok(!normalized!.some((r) => r.ticker === "GOOG"));
});
