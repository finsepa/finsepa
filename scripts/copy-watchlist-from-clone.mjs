/**
 * After "Restore to new project" from July 10 backup, copy watchlist rows
 * for one user into production.
 *
 * Usage:
 *   SOURCE_SUPABASE_URL=... SOURCE_SERVICE_ROLE_KEY=... \
 *   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... \
 *   USER_ID=52373158-0eff-48de-80ba-f9206ee0e52a \
 *   node scripts/copy-watchlist-from-clone.mjs
 *
 * Dry run (default): logs counts only. Set DRY_RUN=0 to apply.
 */
import { createClient } from "@supabase/supabase-js";

const USER_ID = process.env.USER_ID ?? "52373158-0eff-48de-80ba-f9206ee0e52a";
const DRY_RUN = process.env.DRY_RUN !== "0";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const source = createClient(
  requireEnv("SOURCE_SUPABASE_URL"),
  requireEnv("SOURCE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);
const target = createClient(
  requireEnv("TARGET_SUPABASE_URL"),
  requireEnv("TARGET_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

async function fetchAll(client, table, filter) {
  const { data, error } = await client.from(table).select("*").match(filter);
  if (error) throw error;
  return data ?? [];
}

async function main() {
  const [srcCollections, srcItems] = await Promise.all([
    fetchAll(source, "watchlist_collections", { user_id: USER_ID }),
    fetchAll(source, "watchlist", { user_id: USER_ID }),
  ]);

  console.log("Source:", {
    collections: srcCollections.length,
    items: srcItems.length,
    tickers: [...new Set(srcItems.map((r) => r.ticker))].length,
  });

  if (srcItems.length === 0) {
    console.log("No tickers in source — wrong backup or user id.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — pass DRY_RUN=0 to copy into production.");
    return;
  }

  // Replace production rows for this user (structure already exists).
  const { error: delItems } = await target.from("watchlist").delete().eq("user_id", USER_ID);
  if (delItems) throw delItems;
  const { error: delCols } = await target
    .from("watchlist_collections")
    .delete()
    .eq("user_id", USER_ID);
  if (delCols) throw delCols;

  const { error: insCols } = await target.from("watchlist_collections").insert(
    srcCollections.map(({ id: _id, ...row }) => row),
  );
  if (insCols) throw insCols;

  const { data: newCols } = await target
    .from("watchlist_collections")
    .select("id,name")
    .eq("user_id", USER_ID);
  const nameToId = new Map((newCols ?? []).map((c) => [c.name, c.id]));
  const oldToNew = new Map(
    srcCollections.map((c) => [c.id, nameToId.get(c.name)]).filter(([, nid]) => nid),
  );

  const rows = srcItems.map(({ id: _id, collection_id, ...row }) => ({
    ...row,
    collection_id: collection_id ? (oldToNew.get(collection_id) ?? null) : null,
  }));

  const { error: insItems } = await target.from("watchlist").insert(rows);
  if (insItems) throw insItems;

  console.log("Copied to production:", { collections: srcCollections.length, items: rows.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
