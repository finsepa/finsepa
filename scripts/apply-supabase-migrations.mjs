#!/usr/bin/env node
/**
 * Applies all SQL files in `supabase/migrations/` in lexical order against Postgres.
 *
 * Requires either:
 * - DATABASE_URL (or DIRECT_URL / POSTGRES_URL / SUPABASE_DATABASE_URL), or
 * - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD (direct connection to db.<ref>.supabase.co).
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-supabase-migrations.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function pickDatabaseUrl() {
  const keys = ["DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "SUPABASE_DATABASE_URL"];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return null;
}

/** e.g. https://abcdefgh.supabase.co → abcdefgh */
function extractSupabaseProjectRef(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return m ? m[1] : null;
}

/** When only the Supabase URL + DB password are in env (no pooled URI). */
function buildDirectPostgresUrl() {
  const ref = extractSupabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const pwd = process.env.SUPABASE_DB_PASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim();
  if (!ref || !pwd) return null;
  const user = process.env.SUPABASE_DB_USER?.trim() || "postgres";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`;
}

function resolveDatabaseUrl() {
  return pickDatabaseUrl() ?? buildDirectPostgresUrl();
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      "Missing database credentials. Add DATABASE_URL to .env.local (Supabase → Settings → Database → URI),\n" +
        "or set NEXT_PUBLIC_SUPABASE_URL (already set) and SUPABASE_DB_PASSWORD (database password from the same page).",
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

  const client = new pg.Client({
    connectionString: databaseUrl,
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
