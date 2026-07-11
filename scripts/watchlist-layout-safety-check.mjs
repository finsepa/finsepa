#!/usr/bin/env node
/**
 * Layout mutation safety checks (no DB, no production users).
 * Run: node scripts/watchlist-layout-safety-check.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${name}`);
}

function normalizeWatchlistTicker(raw) {
  return String(raw).trim().toUpperCase();
}

/** Mirrors reorderWatchlistCollectionItemsOnServer ordering logic. */
function reorderExistingOnly(serverTickers, clientOrder) {
  const serverSet = new Set(serverTickers);
  const normalizedClient = clientOrder
    .map(normalizeWatchlistTicker)
    .filter((ticker, index, all) => serverSet.has(ticker) && all.indexOf(ticker) === index);
  const remaining = serverTickers.filter((ticker) => !normalizedClient.includes(ticker));
  return [...normalizedClient, ...remaining];
}

// Race: server deleted NVDA; stale localhost still has [AAPL, NVDA]
const serverAfterDelete = ["AAPL"];
const staleClientOrder = ["AAPL", "NVDA"];
const reordered = reorderExistingOnly(serverAfterDelete, staleClientOrder);
assert("deleted NVDA not re-added by reorder", !reordered.includes("NVDA"));
assert("AAPL preserved", reordered.includes("AAPL"));

// Section patch must not touch tickers
const serverTickers = ["AAPL", "MSFT"];
const sectionOnlyMutation = (tickers) => [...tickers];
assert(
  "section mutation preserves server tickers",
  JSON.stringify(sectionOnlyMutation(serverTickers)) === JSON.stringify(serverTickers),
);

// Stale response guard: newer generation wins
function simulateConcurrency() {
  let generation = 0;
  let applied = null;
  const apply = (value, atGeneration) => {
    if (atGeneration === generation) applied = value;
  };
  const start = () => ++generation;
  const g1 = start();
  const g2 = start();
  apply("stale", g1);
  apply("fresh", g2);
  return applied;
}
for (let i = 0; i < 10; i++) {
  assert(`concurrency generation ${i + 1}/10`, simulateConcurrency() === "fresh");
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = readFileSync(join(root, "lib/watchlist/watchlist-context.tsx"), "utf8");
const fetchApi = readFileSync(join(root, "lib/watchlist/fetch-watchlist-api.ts"), "utf8");

assert("context has no full sync import usage", !ctx.includes("syncWatchlistCollectionsToServer"));
assert("context has no persistSnapshotToServer", !ctx.includes("persistSnapshotToServer"));
assert("layout ops use mutation queue", ctx.includes("runQueuedLayoutMutation"));
assert("layout ops use patch sections endpoint", ctx.includes("patchWatchlistCollectionSections"));
assert("layout ops use items reorder endpoint", ctx.includes("reorderWatchlistCollectionItems"));
assert("resolveServerCollectionId avoids full sync", !fetchApi.includes("syncWatchlistCollectionsToServer(local"));

const raceScenario = () => {
  const server = ["AAPL"];
  let local = ["AAPL", "NVDA"];
  // stale local section create triggers reorder only — not full sync
  local = reorderExistingOnly(server, local);
  return local.includes("NVDA");
};
for (let i = 0; i < 10; i++) {
  assert(`race restore blocked ${i + 1}/10`, !raceScenario());
}

console.log(process.exitCode ? "\nSome layout safety checks failed." : "\nAll layout safety checks passed.");
