#!/usr/bin/env node
/**
 * Drag/reorder safety: stale client must not restore deleted tickers via layout PATCH.
 * Uses isolated test user only (WATCHLIST_TEST_USER_EMAIL, default rakshamann.smm@gmail.com).
 * Run: node --env-file=.env.local scripts/watchlist-drag-reorder-safety.mjs
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const TEST_EMAIL = process.env.WATCHLIST_TEST_USER_EMAIL ?? "rakshamann.smm@gmail.com";
const ITERATIONS = 20;

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`PASS: ${name}`);
  return true;
}

function normalizeTicker(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

async function reorderItemsOnly(client, userId, collectionId, orderedTickers) {
  const { rows: items } = await client.query(
    `select id, ticker, sort_order from watchlist
     where user_id = $1 and collection_id = $2`,
    [userId, collectionId],
  );
  const existingByTicker = new Map(items.map((row) => [normalizeTicker(row.ticker), row]));
  const seen = new Set();
  let sortOrder = 0;
  for (const raw of orderedTickers) {
    const ticker = normalizeTicker(raw);
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const row = existingByTicker.get(ticker);
    if (!row) continue;
    if (row.sort_order !== sortOrder) {
      await client.query(`update watchlist set sort_order = $1 where id = $2 and user_id = $3`, [
        sortOrder,
        row.id,
        userId,
      ]);
    }
    sortOrder += 1;
  }
}

async function patchSectionsOnly(client, userId, collectionId, sections, tickerSections) {
  const { rows: items } = await client.query(
    `select ticker from watchlist where user_id = $1 and collection_id = $2`,
    [userId, collectionId],
  );
  const collectionTickerKeys = new Set(items.map((row) => normalizeTicker(row.ticker)));
  const filtered = {};
  for (const [key, sectionId] of Object.entries(tickerSections)) {
    const tickerKey = normalizeTicker(key);
    if (collectionTickerKeys.has(tickerKey)) {
      filtered[tickerKey] = sectionId;
    }
  }
  await client.query(
    `update watchlist_collections
     set sections_layout = $1::jsonb
     where id = $2 and user_id = $3`,
    [JSON.stringify({ sections, tickerSections: filtered }), collectionId, userId],
  );
}

async function countItems(client, userId, collectionId) {
  const { rows } = await client.query(
    `select ticker from watchlist where user_id = $1 and collection_id = $2 order by sort_order`,
    [userId, collectionId],
  );
  return rows.map((r) => normalizeTicker(r.ticker));
}

const contextBody = readFileSync("lib/watchlist/watchlist-context.tsx", "utf8");
const moveBlock = contextBody.slice(
  contextBody.indexOf("const moveActiveWatchlistItem"),
  contextBody.indexOf("const createWatchlist"),
);
const reorderBlock = contextBody.slice(
  contextBody.indexOf("const reorderActiveWatchlist"),
  contextBody.indexOf("const moveActiveWatchlistItem"),
);
const persistDragBlock = contextBody.slice(
  contextBody.indexOf("const persistDragOrReorderLayout"),
  contextBody.indexOf("const reorderActiveWatchlist"),
);

assert("moveActiveWatchlistItem does not call persistSnapshotToServer", !moveBlock.includes("persistSnapshotToServer"));
assert("reorderActiveWatchlist does not call persistSnapshotToServer", !reorderBlock.includes("persistSnapshotToServer"));
assert("persistDragOrReorderLayout uses patchWatchlistCollectionItemsReorder", persistDragBlock.includes("patchWatchlistCollectionItemsReorder"));
assert("persistDragOrReorderLayout uses patchWatchlistCollectionSections for drag", persistDragBlock.includes("patchWatchlistCollectionSections"));
assert("moveActiveWatchlistItem uses persistDragOrReorderLayout", moveBlock.includes("persistDragOrReorderLayout"));
assert("reorderActiveWatchlist uses persistDragOrReorderLayout", reorderBlock.includes("persistDragOrReorderLayout"));

const env = loadEnv();
const client = new pg.Client({
  connectionString: env.SUPABASE_POOLER_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const userRes = await client.query(`select id from auth.users where email = $1 limit 1`, [TEST_EMAIL]);
const userId = userRes.rows[0]?.id;
if (!userId) {
  console.error(`SKIP: test user not found (${TEST_EMAIL})`);
  await client.end();
  process.exit(0);
}

const colRes = await client.query(
  `select id from watchlist_collections where user_id = $1 order by sort_order, created_at limit 1`,
  [userId],
);
const collectionId = colRes.rows[0]?.id;
if (!collectionId) {
  console.error("SKIP: test user has no watchlist collection");
  await client.end();
  process.exit(0);
}

await client.query(`delete from watchlist where user_id = $1 and collection_id = $2`, [userId, collectionId]);
await client.query(
  `insert into watchlist (user_id, collection_id, ticker, sort_order) values ($1, $2, 'RACE', 0)`,
  [userId, collectionId],
);

const sectionId = "wls_test_section";
const sections = [{ id: sectionId, name: "Consumer Cyclical" }];
const staleTickerSections = { AAPL: sectionId, RACE: sectionId };
const staleOrder = ["AAPL", "RACE"];

for (let i = 0; i < ITERATIONS; i++) {
  await reorderItemsOnly(client, userId, collectionId, staleOrder);
  let tickers = await countItems(client, userId, collectionId);
  if (!assert(`iteration ${i + 1}: reorder does not restore AAPL`, !tickers.includes("AAPL"))) break;
  assert(`iteration ${i + 1}: reorder keeps RACE`, tickers.includes("RACE"));

  await patchSectionsOnly(client, userId, collectionId, sections, staleTickerSections);
  tickers = await countItems(client, userId, collectionId);
  if (!assert(`iteration ${i + 1}: section patch does not restore AAPL`, !tickers.includes("AAPL"))) break;
  assert(`iteration ${i + 1}: membership count unchanged after section patch`, tickers.length === 1);
}

const finalTickers = await countItems(client, userId, collectionId);
assert("final membership count is 1", finalTickers.length === 1);
assert("final tickers are only RACE", finalTickers.join(",") === "RACE");

await client.end();

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log(`Done (${ITERATIONS} drag/reorder simulations on ${TEST_EMAIL}).`);
