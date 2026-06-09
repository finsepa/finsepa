#!/usr/bin/env node
/**
 * Insert one test in-app notification (earnings_released) for a user.
 *
 * Usage:
 *   node --env-file=.env.local scripts/insert-test-notification.mjs you@example.com
 *   node --env-file=.env.local scripts/insert-test-notification.mjs   # first watchlist user
 */

import pg from "pg";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

const emailArg = process.argv[2]?.trim().toLowerCase() || null;

async function resolveUserId(client) {
  if (emailArg) {
    const r = await client.query("SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1", [
      emailArg,
    ]);
    if (r.rows[0]?.id) return r.rows[0].id;
    throw new Error(`No auth user for email: ${emailArg}`);
  }

  const r = await client.query(
    `SELECT w.user_id AS id, u.email
     FROM public.watchlist w
     JOIN auth.users u ON u.id = w.user_id
     ORDER BY w.created_at DESC
     LIMIT 1`,
  );
  if (r.rows[0]?.id) {
    console.log(`Using watchlist user: ${r.rows[0].email ?? r.rows[0].id}`);
    return r.rows[0].id;
  }

  throw new Error("Pass <email> or add a ticker to your watchlist first.");
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
    const userId = await resolveUserId(client);
    const dedupeKey = `TEST:${Date.now()}`;
    const title = "HealthEquity reported earnings";
    const body = "Q2 · 2026";
    const href = "/stock/HQY?tab=earnings";
    const payload = {
      ticker: "HQY",
      companyName: "HealthEquity",
      fiscalPeriodLabel: "Q2 · 2026",
      fiscalPeriodEndYmd: "2026-04-30",
      reportDateYmd: "2026-06-08",
      epsActual: 1.24,
      epsEstimate: 1.13,
      surprisePct: 9.7345,
      revenueActual: 354_641_000,
      revenueEstimate: 352_170_990,
      revenueSurprisePct: 0.7014,
      href,
      test: true,
    };

    const ins = await client.query(
      `INSERT INTO public.user_notifications
        (user_id, kind, ticker, title, body, href, payload, dedupe_key)
       VALUES ($1, 'earnings_released', 'HQY', $2, $3, $4, $5::jsonb, $6)
       RETURNING id, created_at`,
      [userId, title, body, href, JSON.stringify(payload), dedupeKey],
    );

    const row = ins.rows[0];
    console.log("✓ Test notification inserted");
    console.log(`  user_id: ${userId}`);
    console.log(`  id:      ${row.id}`);
    console.log(`  at:      ${row.created_at}`);
    console.log("\nOpen the app → bell icon → you should see the alert.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
