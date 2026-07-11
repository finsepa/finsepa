#!/usr/bin/env node
/**
 * P0 safety checks for adoptCanonicalServerSnapshot (no DB, no production users).
 * Run: node scripts/watchlist-p0-safety-check.mjs
 */

function unionTickers(snapshot) {
  return snapshot.lists.flatMap((list) => list.tickers);
}

function adoptCanonicalServerSnapshot(server, local) {
  const lists = server.collections.map((serverCollection) => {
    const localList = local.lists.find(
      (list) => list.name.toLowerCase() === serverCollection.name.toLowerCase(),
    );
    return {
      id: serverCollection.id,
      name: localList?.name ?? serverCollection.name,
      tickers: [...serverCollection.tickers],
    };
  });
  return { lists };
}

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${name}`);
}

const server10 = {
  collections: [
    { id: "s1", name: "Watchlist", tickers: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] },
  ],
};

const emptyLocal = {
  lists: [{ id: "wl_local", name: "Watchlist", tickers: [] }],
};

const stale2 = {
  lists: [{ id: "wl_local", name: "Watchlist", tickers: ["A", "B"] }],
};

const staleWithAapl = {
  lists: [{ id: "wl_local", name: "Watchlist", tickers: ["AAPL", "B"] }],
};

const serverNoAapl = {
  collections: [{ id: "s1", name: "Watchlist", tickers: ["B"] }],
};

// A. Server 10, empty local → client becomes 10 (no upload in bootstrap; adopt only)
const adoptedA = adoptCanonicalServerSnapshot(server10, emptyLocal);
assert("A client downloads 10", unionTickers(adoptedA).length === 10);

// B. Server 10, stale local 2 → client becomes 10
const adoptedB = adoptCanonicalServerSnapshot(server10, stale2);
assert("B client becomes 10 not 2", unionTickers(adoptedB).length === 10);

// C. Server has AAPL — stale local without (server adds AAPL)
const serverWithAapl = {
  collections: [{ id: "s1", name: "Watchlist", tickers: ["AAPL"] }],
};
const localNoAapl = {
  lists: [{ id: "wl_local", name: "Watchlist", tickers: [] }],
};
const adoptedC = adoptCanonicalServerSnapshot(serverWithAapl, localNoAapl);
assert("C AAPL stays on client", unionTickers(adoptedC).includes("AAPL"));

// D. Server removed AAPL — stale local still has AAPL
const adoptedD = adoptCanonicalServerSnapshot(serverNoAapl, staleWithAapl);
assert("D AAPL not restored", !unionTickers(adoptedD).includes("AAPL"));

// Static grep guard: bootstrap must not call ahead/removal upload helpers
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = readFileSync(join(root, "lib/watchlist/watchlist-context.tsx"), "utf8");
assert("bootstrap has canonical adopt log", ctx.includes('logWatchlistSync("bootstrap_server_canonical_adopt")'));
assert(
  "bootstrap removed ahead-of-server upload branch",
  !ctx.includes("localSnapshotHasTickersAheadOfServer"),
);
assert(
  "bootstrap removed removals-pending upload branch",
  !ctx.includes("localSnapshotHasRemovalsPendingSync"),
);
assert(
  "context has no normal full sync calls",
  !ctx.includes("syncWatchlistCollectionsToServer") && !ctx.includes("persistSnapshotToServer"),
);
const bootstrapMatch = ctx.match(/async function bootstrap\([\s\S]*?\n    \}/);
const bootstrapBody = bootstrapMatch?.[0] ?? "";
assert(
  "E bootstrap never calls full sync",
  bootstrapBody.length > 0 && !bootstrapBody.includes("syncWatchlistCollectionsToServer"),
);
assert(
  "F failed GET returns without sync",
  ctx.includes('logWatchlistSync("bootstrap_server_fetch_miss")') &&
    /if \(!snapshot\)[\s\S]{0,200}return/.test(ctx),
);
assert(
  "G canonical adopt uses server tickers only",
  ctx.includes("adoptServerCanonical(serverSnapshot)") &&
    ctx.includes("adoptCanonicalServerSnapshot"),
);

console.log(process.exitCode ? "\nSome checks failed." : "\nAll P0 safety checks passed.");
