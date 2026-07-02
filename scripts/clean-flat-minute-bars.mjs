#!/usr/bin/env node
/**
 * Remove polluted flat minute bars (stale polled spot writes) for today's US session.
 * Usage: npm run stock:clean-flat-bars -- --ticker=AAPL
 *        npm run stock:clean-flat-bars -- --all-priority
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();
const MIN_SPREAD_USD = Number(process.env.STOCK_SESSION_MINUTE_BAR_MIN_SPREAD_USD ?? 0.5);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const tickerArg = process.argv.find((a) => a.startsWith("--ticker="))?.slice("--ticker=".length)?.trim().toUpperCase();
const allPriority = process.argv.includes("--all-priority");
const dryRun = process.argv.includes("--dry-run");

const DISPLAY_TZ = "America/New_York";
const todayYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await supabase
  .from("stock_session_minute_bar")
  .select("ticker, close, bucket_unix")
  .eq("session_ymd", todayYmd)
  .order("ticker")
  .order("bucket_unix", { ascending: true });

if (error) {
  console.error("fetch error", error.message);
  process.exit(1);
}

/** @type {Map<string, number[]>} */
const byTicker = new Map();
for (const row of rows ?? []) {
  const t = String(row.ticker ?? "").trim().toUpperCase();
  if (!t) continue;
  if (tickerArg && t !== tickerArg) continue;
  const list = byTicker.get(t) ?? [];
  list.push(Number(row.close));
  byTicker.set(t, list);
}

const flatTickers = [];
for (const [ticker, closes] of byTicker) {
  if (closes.length < 2) {
    flatTickers.push({ ticker, count: closes.length, spread: 0, unique: [...new Set(closes)] });
    continue;
  }
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min;
  if (spread < MIN_SPREAD_USD) {
    flatTickers.push({
      ticker,
      count: closes.length,
      spread: Number(spread.toFixed(4)),
      unique: [...new Set(closes)].slice(0, 6),
    });
  }
}

if (!flatTickers.length) {
  console.log(JSON.stringify({ at: new Date().toISOString(), todayYmd, removed: 0, note: "no flat tickers" }, null, 2));
  process.exit(0);
}

if (!tickerArg && !allPriority) {
  console.error("Pass --ticker=SYM or --all-priority. Flat tickers:", flatTickers.map((t) => t.ticker).join(", "));
  process.exit(1);
}

let removed = 0;
for (const { ticker, count, spread, unique } of flatTickers) {
  console.log(dryRun ? "[dry-run] would delete" : "deleting", { ticker, count, spread, unique });
  if (dryRun) {
    removed += count;
    continue;
  }
  const { error: delErr, count: delCount } = await supabase
    .from("stock_session_minute_bar")
    .delete({ count: "exact" })
    .eq("ticker", ticker)
    .eq("session_ymd", todayYmd);
  if (delErr) {
    console.error("delete error", ticker, delErr.message);
    process.exit(1);
  }
  removed += delCount ?? 0;
}

console.log(JSON.stringify({ at: new Date().toISOString(), todayYmd, flatTickers, removed, dryRun }, null, 2));
