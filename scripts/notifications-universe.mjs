#!/usr/bin/env node
/**
 * Dry-run: earnings notification universe size + estimated EODHD usage.
 * Reads Supabase only — no EODHD API calls, no notifications inserted.
 *
 * Usage:
 *   node --env-file=.env.local scripts/notifications-universe.mjs
 */

import pg from "pg";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

const WATCHLIST_CRYPTO_PREFIX = "CRYPTO:";
const WATCHLIST_INDEX_PREFIX = "INDEX:";
const CUSTOM_PREFIX = "CUST:";
const CALENDAR_BATCH_SIZE = 80;
const CRON_RUNS_PER_DAY = 48;

/** Matches lib/market/earnings-scope-filter.ts */
function earningsScopeKey(ticker) {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/-/g, ".");
}

function canonicalNotifyTicker(raw) {
  const t = earningsScopeKey(raw);
  const m = /^([A-Z]{1,10})\.([A-Z0-9]{1,3})$/.exec(t);
  if (m) return m[1];
  return t;
}

/** Simplified vs app: prefix/custom/index checks (same rules as cron). */
function isEarningsNotifiableTicker(raw) {
  const s = raw.trim();
  if (!s) return false;
  if (s.toUpperCase().startsWith(CUSTOM_PREFIX)) return false;
  const upper = s.toUpperCase();
  if (upper.startsWith(WATCHLIST_CRYPTO_PREFIX) || upper.startsWith(WATCHLIST_INDEX_PREFIX)) {
    return false;
  }
  if (upper.includes(":")) return false;
  return /^[A-Z0-9][A-Z0-9.\-]{0,14}$/i.test(upper);
}

function parsePortfolioHoldings(stateBody) {
  if (stateBody == null) return [];
  try {
    const parsed = typeof stateBody === "string" ? JSON.parse(stateBody) : stateBody;
    const holdingsByPortfolioId = parsed?.holdingsByPortfolioId;
    if (!holdingsByPortfolioId || typeof holdingsByPortfolioId !== "object") return [];
    const out = [];
    for (const rows of Object.values(holdingsByPortfolioId)) {
      if (!Array.isArray(rows)) continue;
      for (const h of rows) {
        if (!h || typeof h !== "object") continue;
        const symbol = typeof h.symbol === "string" ? h.symbol : "";
        const shares = typeof h.shares === "number" ? h.shares : Number(h.shares);
        if (!symbol || !Number.isFinite(shares) || shares <= 0) continue;
        out.push({ symbol, userId: null });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function addInterest(map, rawTicker, userId, stats, source) {
  if (!isEarningsNotifiableTicker(rawTicker)) {
    stats.excluded += 1;
    stats.excludedBySource[source] = (stats.excludedBySource[source] ?? 0) + 1;
    return;
  }
  const key = canonicalNotifyTicker(rawTicker);
  if (!key) return;
  stats.includedBySource[source] = (stats.includedBySource[source] ?? 0) + 1;
  let users = map.get(key);
  if (!users) {
    users = new Set();
    map.set(key, users);
  }
  users.add(userId);
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

async function main() {
  const databaseUrl = resolveSupabaseDatabaseUrl();
  if (!databaseUrl) {
    console.error("Missing DB credentials (SUPABASE_POOLER_URL or DATABASE_URL).");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const watchRes = await client.query("SELECT user_id, ticker FROM public.watchlist");
    const portRes = await client.query("SELECT user_id, state FROM public.portfolio_workspace");
    const optOutRes = await client.query(
      "SELECT count(*)::int AS n FROM public.user_notification_preferences WHERE earnings_results_enabled = false",
    );
    const authRes = await client.query("SELECT count(*)::int AS n FROM auth.users");

    const interest = new Map();
    const stats = {
      excluded: 0,
      excludedBySource: { watchlist: 0, holdings: 0 },
      includedBySource: { watchlist: 0, holdings: 0 },
    };

    for (const row of watchRes.rows) {
      if (typeof row.user_id !== "string" || typeof row.ticker !== "string") continue;
      addInterest(interest, row.ticker, row.user_id, stats, "watchlist");
    }

    for (const row of portRes.rows) {
      if (typeof row.user_id !== "string") continue;
      const holdings = parsePortfolioHoldings(row.state);
      for (const h of holdings) {
        addInterest(interest, h.symbol, row.user_id, stats, "holdings");
      }
    }

    const tickers = [...interest.keys()].sort((a, b) => a.localeCompare(b));
    const usersWithInterest = new Set();
    let totalInterestPairs = 0;
    for (const users of interest.values()) {
      totalInterestPairs += users.size;
      for (const uid of users) usersWithInterest.add(uid);
    }

    const batchesPerRun = tickers.length === 0 ? 0 : Math.ceil(tickers.length / CALENDAR_BATCH_SIZE);
    const calendarCallsPerDay = batchesPerRun * CRON_RUNS_PER_DAY;

    const topByUsers = [...interest.entries()]
      .map(([ticker, users]) => ({ ticker, users: users.size }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10);

    console.log("Earnings notification universe (dry run)");
    console.log("──────────────────────────────────────");
    console.log(`Auth users (total):              ${fmt(authRes.rows[0]?.n ?? 0)}`);
    console.log(`Users with notification interest: ${fmt(usersWithInterest.size)}`);
    console.log(`Users opted out (earnings off):   ${fmt(optOutRes.rows[0]?.n ?? 0)}`);
    console.log("");
    console.log("Sources");
    console.log(`  Watchlist rows (eligible):     ${fmt(stats.includedBySource.watchlist)}`);
    console.log(`  Holdings rows (eligible):      ${fmt(stats.includedBySource.holdings)}`);
    console.log(`  Excluded tickers (skipped):    ${fmt(stats.excluded)}`);
    console.log(`    from watchlist:              ${fmt(stats.excludedBySource.watchlist ?? 0)}`);
    console.log(`    from holdings:               ${fmt(stats.excludedBySource.holdings ?? 0)}`);
    console.log("");
    console.log("Universe");
    console.log(`  Unique tickers (EODHD poll):    ${fmt(tickers.length)}`);
    console.log(`  User×ticker interest pairs:    ${fmt(totalInterestPairs)}`);
    console.log("");
    console.log("Estimated EODHD usage (calendar cron only)");
    console.log(`  Batch size:                    ${CALENDAR_BATCH_SIZE} tickers/request`);
    console.log(`  Batches per cron run:          ${fmt(batchesPerRun)}`);
    console.log(`  Cron runs per day:             ${CRON_RUNS_PER_DAY} (every 30m)`);
    console.log(`  Calendar API calls / day:      ~${fmt(calendarCallsPerDay)}`);
    console.log("  Enrich (fundamentals):         +1 call per unique ticker only when a new report is detected (usually a handful/day)");
    console.log("");
    if (topByUsers.length > 0) {
      console.log("Top tickers by interested users");
      for (const { ticker, users } of topByUsers) {
        console.log(`  ${ticker.padEnd(8)} ${fmt(users)} users`);
      }
      console.log("");
    }
    console.log("Notes");
    console.log("  • Cost scales with unique tickers, not user count.");
    console.log("  • Users need watchlist rows and/or portfolio holdings to receive alerts.");
    console.log("  • No EODHD requests were made by this script.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
