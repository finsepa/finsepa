#!/usr/bin/env node
/**
 * Applies all SQL files in `supabase/migrations/` in lexical order against Postgres.
 *
 * Requires either:
 * - `SUPABASE_POOLER_HOST` or `SUPABASE_POOLER_REGION` + `SUPABASE_DB_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL`
 *   (recommended when direct `db.<ref>.supabase.co` times out — IPv6-only DNS), or
 * - `DATABASE_URL` (or DIRECT_URL / POSTGRES_URL / SUPABASE_DATABASE_URL), or
 * - `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_DB_PASSWORD` (direct `db.<ref>.supabase.co`).
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-supabase-migrations.mjs
 */

import dns from "node:dns";
import { promises as dnsPromises } from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/**
 * Replace hostname with IPv4 when possible (direct `db.*.supabase.co` may be IPv6-only).
 * Skipped for `pooler.supabase.com` (usually has working IPv4).
 */
async function connectionStringWithIpv4Host(connectionString) {
  if (connectionString.includes("pooler.supabase.com")) return connectionString;
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    url = new URL(connectionString.replace(/^postgresql:/i, "http:"));
  }
  const host = url.hostname;
  if (!host || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return connectionString;
  try {
    const { address } = await dnsPromises.lookup(host, { family: 4 });
    url.hostname = address;
    const out = url.toString();
    return out.startsWith("http:") ? out.replace(/^http:/i, "postgresql:") : out;
  } catch {
    return connectionString;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

async function main() {
  const databaseUrl = resolveSupabaseDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      "Missing database credentials.\n" +
        "Recommended (IPv6-safe): set SUPABASE_POOLER_HOST (from Supabase Connect → Session pooler) or\n" +
        "SUPABASE_POOLER_REGION (e.g. eu-central-1) plus SUPABASE_DB_PASSWORD and NEXT_PUBLIC_SUPABASE_URL.\n" +
        "Or set DATABASE_URL to a Postgres URI.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error("No migrations directory:", migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("No .sql files in", migrationsDir);
    process.exit(1);
  }

  const connectUrl = await connectionStringWithIpv4Host(databaseUrl);
  const client = new pg.Client({
    connectionString: connectUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const name of files) {
      const full = path.join(migrationsDir, name);
      const sql = fs.readFileSync(full, "utf8");
      process.stdout.write(`Applying ${name} … `);
      await client.query(sql);
      console.log("ok");
    }
    console.log(`Done (${files.length} file(s)).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
