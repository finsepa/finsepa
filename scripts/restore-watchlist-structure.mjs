/**
 * Restores watchlist collection structure for rakshamann@gmail.com from the last
 * known local snapshot (4 lists). Does not invent tickers — run after a Supabase
 * backup restore for full ticker recovery.
 *
 * Usage: node scripts/restore-watchlist-structure.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const USER_ID = "52373158-0eff-48de-80ba-f9206ee0e52a";
const ACTIVE_NAME = "For later";

/** Last known structure from browser localStorage before wipe. */
const LISTS = [
  { name: "Watching", sortOrder: 0 },
  { name: "Watchlist", sortOrder: 1 },
  { name: "For later", sortOrder: 2 },
  { name: "Core", sortOrder: 3 },
];

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function namesMatch(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

const { data: existing, error: listErr } = await supabase
  .from("watchlist_collections")
  .select("id,name,sort_order")
  .eq("user_id", USER_ID)
  .order("sort_order", { ascending: true });

if (listErr) throw listErr;

const byName = new Map((existing ?? []).map((row) => [row.name.toLowerCase(), row]));
const resolved = [];

for (const list of LISTS) {
  const found = [...byName.entries()].find(([key]) => namesMatch(key, list.name))?.[1];
  if (found) {
    if (found.sort_order !== list.sortOrder || found.name !== list.name) {
      const { error } = await supabase
        .from("watchlist_collections")
        .update({ name: list.name, sort_order: list.sortOrder })
        .eq("id", found.id)
        .eq("user_id", USER_ID);
      if (error) throw error;
    }
    resolved.push({ ...found, name: list.name, sort_order: list.sortOrder });
    continue;
  }

  const { data: created, error } = await supabase
    .from("watchlist_collections")
    .insert({
      user_id: USER_ID,
      name: list.name,
      sort_order: list.sortOrder,
      sections_layout: { sections: [], tickerSections: {} },
    })
    .select("id,name,sort_order")
    .single();

  if (error) throw error;
  resolved.push(created);
}

const active = resolved.find((row) => namesMatch(row.name, ACTIVE_NAME)) ?? resolved[0];
if (!active) throw new Error("No active watchlist resolved.");

const { error: stateErr } = await supabase.from("watchlist_user_state").upsert(
  {
    user_id: USER_ID,
    active_collection_id: active.id,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "user_id" },
);
if (stateErr) throw stateErr;

const { count: itemCount } = await supabase
  .from("watchlist")
  .select("*", { count: "exact", head: true })
  .eq("user_id", USER_ID);

console.log(
  JSON.stringify(
    {
      ok: true,
      userId: USER_ID,
      collections: resolved.map((row) => row.name),
      active: active.name,
      tickerCount: itemCount ?? 0,
      note:
        itemCount && itemCount > 0
          ? "Tickers present — structure restore complete."
          : "Collections restored. Tickers still empty — restore July 10 backup in Supabase Dashboard for full recovery.",
    },
    null,
    2,
  ),
);
