#!/usr/bin/env node
/**
 * SnapTrade sandbox status — connections + accounts (free tier: up to 5 test connections).
 *
 * Usage:
 *   node --env-file=.env.local scripts/snaptrade-test-status.mjs
 *   node --env-file=.env.local scripts/snaptrade-test-status.mjs you@example.com
 *
 * To add test connections in Finsepa:
 *   1. Portfolio menu (chevron) → Connect brokerage
 *   2. Pick a broker (easiest: Alpaca Paper — free at https://app.alpaca.markets/signup)
 *   3. Repeat up to 5 connections on your free SnapTrade API key
 *
 * @see https://docs.snaptrade.com/demo/getting-started
 */

import pg from "pg";
import { Snaptrade } from "snaptrade-typescript-sdk";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

const FREE_TEST_CONNECTION_LIMIT = 5;
const emailArg = process.argv[2]?.trim().toLowerCase() || null;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in environment.`);
  return v;
}

async function resolveTargetUser(client) {
  if (emailArg) {
    const r = await client.query("SELECT id, email FROM auth.users WHERE lower(email) = $1 LIMIT 1", [
      emailArg,
    ]);
    if (r.rows[0]?.id) return r.rows[0];
    throw new Error(`No auth user for email: ${emailArg}`);
  }

  const r = await client.query(
    `SELECT su.user_id AS id, u.email
     FROM public.snaptrade_users su
     JOIN auth.users u ON u.id = su.user_id
     ORDER BY su.updated_at DESC
     LIMIT 1`,
  );
  if (r.rows[0]?.id) return r.rows[0];

  throw new Error("Pass <email> or connect brokerage once in the app first.");
}

async function main() {
  const clientId = requireEnv("SNAPTRADE_CLIENT_ID");
  const consumerKey = requireEnv("SNAPTRADE_CONSUMER_KEY");
  const databaseUrl = resolveSupabaseDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("Missing DB credentials (SUPABASE_POOLER_URL or DATABASE_URL).");
  }

  const snaptrade = new Snaptrade({ clientId, consumerKey });
  const status = await snaptrade.apiStatus.check();
  console.log("SnapTrade API:", status.data?.online === true ? "online" : status.data);

  const pgClient = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await pgClient.connect();

  try {
    const user = await resolveTargetUser(pgClient);
    console.log(`\nFinsepa user: ${user.email ?? user.id}`);

    const creds = await pgClient.query(
      `SELECT snaptrade_user_id, user_secret, updated_at
       FROM public.snaptrade_users
       WHERE user_id = $1`,
      [user.id],
    );
    const row = creds.rows[0];
    if (!row?.snaptrade_user_id || !row.user_secret) {
      console.log("\nNo SnapTrade user registered yet.");
      console.log("→ Open /portfolio → portfolio menu → Connect brokerage");
      return;
    }

    const { snaptrade_user_id: userId, user_secret: userSecret } = row;
    console.log(`SnapTrade user id: ${userId}`);

    const connectionsRes = await snaptrade.connections.listBrokerageAuthorizations({
      userId,
      userSecret,
    });
    const connections = Array.isArray(connectionsRes.data) ? connectionsRes.data : [];
    console.log(`\nConnections: ${connections.length} / ${FREE_TEST_CONNECTION_LIMIT} (free test tier)`);

    if (connections.length === 0) {
      console.log("\nNo brokerages connected yet.");
      console.log("→ Portfolio menu → Connect brokerage → choose Alpaca Paper (recommended for testing)");
      console.log("  Sign up: https://app.alpaca.markets/signup");
      return;
    }

    for (const [i, conn] of connections.entries()) {
      const brokerage = conn.brokerage && typeof conn.brokerage === "object" ? conn.brokerage : {};
      const name =
        (typeof brokerage.name === "string" && brokerage.name) ||
        (typeof conn.name === "string" && conn.name) ||
        "Unknown broker";
      const disabled = conn.disabled === true ? " · NEEDS RECONNECT" : "";
      console.log(`\n  ${i + 1}. ${name}${disabled}`);
      console.log(`     authorization: ${conn.id ?? "?"}`);
      console.log(`     type: ${conn.type ?? "read"}`);

      if (!conn.id) continue;
      try {
        const accountsRes = await snaptrade.connections.listBrokerageAuthorizationAccounts({
          authorizationId: conn.id,
          userId,
          userSecret,
        });
        const accounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
        if (accounts.length === 0) {
          console.log("     accounts: (none yet — SnapTrade may still be syncing)");
          continue;
        }
        for (const acct of accounts) {
          const label = acct.name ?? acct.number ?? acct.id ?? "Account";
          const balance =
            acct.balance?.total?.amount != null ?
              ` · $${Number(acct.balance.total.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            : "";
          console.log(`     · ${label}${balance}`);
        }
      } catch (e) {
        console.log(`     accounts: error — ${e instanceof Error ? e.message : e}`);
      }
    }

    const accountsRes = await snaptrade.accountInformation.listUserAccounts({ userId, userSecret });
    const allAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    console.log(`\nTotal SnapTrade accounts across connections: ${allAccounts.length}`);

    if (connections.length < FREE_TEST_CONNECTION_LIMIT) {
      const remaining = FREE_TEST_CONNECTION_LIMIT - connections.length;
      console.log(`\nYou can add ${remaining} more test connection${remaining === 1 ? "" : "s"}:`);
      console.log("  Portfolio menu → Connect brokerage (pick another broker or another Alpaca Paper login)");
    } else {
      console.log("\nYou've reached the 5 free test connections. Delete one in SnapTrade dashboard or contact SnapTrade to go live.");
    }
  } finally {
    await pgClient.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
