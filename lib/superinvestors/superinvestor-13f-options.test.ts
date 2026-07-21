/**
 * Pure checks for put/call exclusion from 13F equity aggregation (Phase 3).
 * Run: node --test --experimental-strip-types lib/superinvestors/superinvestor-13f-options.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirrors production parse filter: equity rows only (no putCall).
 * Kept local so the test does not import server-only modules.
 */
function filterEquityRows<T extends { putCall: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.putCall == null);
}

test("put/call option rows are excluded from equity holdings", () => {
  const rows = [
    { issuer: "MOLINA", putCall: null as string | null, value: 23 },
    { issuer: "NVIDIA", putCall: "put", value: 186 },
    { issuer: "PALANTIR", putCall: "Put", value: 912 },
    { issuer: "PFIZER", putCall: "call", value: 152 },
    { issuer: "SLM", putCall: null, value: 13 },
  ];
  const equity = filterEquityRows(
    rows.map((r) => ({ ...r, putCall: r.putCall ? r.putCall.toLowerCase() : null })),
  );
  assert.equal(equity.length, 2);
  assert.deepEqual(
    equity.map((r) => r.issuer),
    ["MOLINA", "SLM"],
  );
});

test("preferred equity without putCall is retained", () => {
  const rows = [
    { issuer: "BRUKER", title: "6.375 PREF SER A", putCall: null as string | null },
    { issuer: "HAL", title: "COM", putCall: "call" as string | null },
  ];
  const equity = filterEquityRows(rows);
  assert.equal(equity.length, 1);
  assert.equal(equity[0]?.issuer, "BRUKER");
});
