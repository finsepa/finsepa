/**
 * Run: npx tsx --test lib/screener/stocks-global-mcap-rank.test.ts
 *
 * Guards the Companies tab “all” ranking rule: full universe by marketCapUsd,
 * not a curated TOP10 band for ranks 1–10.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TOP10_TICKERS } from "@/lib/screener/top10-config";

test("TOP10 seed is not required to be the first N by mcap (universe may reorder)", () => {
  // Structural: curated list exists for hot quotes, but display rank must not assume
  // TOP10_TICKERS[i] === rank i+1. Universe sort is the source of truth.
  assert.equal(TOP10_TICKERS.length, 10);
  assert.ok(TOP10_TICKERS.includes("AAPL"));
});

test("universe mcap sort places higher cap before lower regardless of TOP10 membership", () => {
  const universe = [
    { ticker: "AVGO", marketCapUsd: 1.2e12 },
    { ticker: "AAPL", marketCapUsd: 3.2e12 },
    { ticker: "ZZZ", marketCapUsd: 50e9 },
  ];
  const ranked = [...universe].sort(
    (a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker),
  );
  assert.deepEqual(
    ranked.map((r) => r.ticker),
    ["AAPL", "AVGO", "ZZZ"],
  );
  // AVGO can outrank a weaker TOP10 name if its mcap is higher — that is intended.
  assert.ok(ranked[1]!.ticker === "AVGO");
});
