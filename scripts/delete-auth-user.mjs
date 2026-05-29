#!/usr/bin/env node
/**
 * Delete one auth user and related data (public tables cascade from auth.users).
 *
 * Dry run:
 *   node --env-file=.env.local scripts/delete-auth-user.mjs --email user@example.com
 *   node --env-file=.env.local scripts/delete-auth-user.mjs --id <uuid>
 *
 * Delete:
 *   node --env-file=.env.local scripts/delete-auth-user.mjs --email user@example.com --delete
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const doDelete = process.argv.includes("--delete");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1]?.trim() || null;
}

const emailArg = argValue("--email")?.toLowerCase() ?? null;
const idArg = argValue("--id") ?? null;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!emailArg && !idArg) {
  console.error("Pass --email <address> or --id <uuid>.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmailSql(email) {
  const poolUrl = process.env.SUPABASE_POOLER_URL?.trim();
  if (!poolUrl) return null;
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: poolUrl });
  await client.connect();
  try {
    const r = await client.query(
      "select id from auth.users where lower(email) = lower($1) limit 1",
      [email],
    );
    const id = r.rows[0]?.id;
    if (!id) return null;
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) return null;
    return data.user ?? null;
  } finally {
    await client.end();
  }
}

async function findUser() {
  if (idArg) {
    const { data, error } = await admin.auth.admin.getUserById(idArg);
    if (error) throw new Error(error.message);
    return data.user ?? null;
  }

  if (emailArg) {
    const fromSql = await findUserByEmailSql(emailArg);
    if (fromSql) return fromSql;
  }

  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === emailArg);
    if (match) return match;
    if (users.length < 1000) break;
    page += 1;
  }
  return null;
}

async function countRow(table, userId) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) return `? (${error.message})`;
  return count ?? 0;
}

async function main() {
  const user = await findUser();
  if (!user) {
    console.error("No user found.");
    process.exit(1);
  }

  const meta = user.user_metadata ?? {};
  console.log("User:");
  console.log("  id:", user.id);
  console.log("  email:", user.email);
  console.log("  created_at:", user.created_at);
  console.log("  name:", meta.first_name, meta.last_name, meta.full_name);

  const tables = [
    "watchlist",
    "portfolio_workspace",
    "billing_subscriptions",
    "billing_customers",
    "billing_invoices",
    "public_portfolio_listings",
    "superinvestor_follows",
  ];

  console.log("\nRelated rows (public):");
  for (const t of tables) {
    console.log(`  ${t}:`, await countRow(t, user.id));
  }

  const avatarPrefix = `${user.id}/`;
  const { data: avatarFiles } = await admin.storage.from("avatars").list(user.id, { limit: 20 });
  console.log("  avatars storage:", avatarFiles?.length ?? 0, "file(s) under", avatarPrefix);

  if (!doDelete) {
    console.log("\nDRY RUN — pass --delete to remove this user.");
    return;
  }

  if (avatarFiles?.length) {
    const paths = avatarFiles.map((f) => `${user.id}/${f.name}`);
    const { error: storageErr } = await admin.storage.from("avatars").remove(paths);
    if (storageErr) console.warn("avatars remove:", storageErr.message);
    else console.log("Removed avatar files:", paths.join(", "));
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("deleteUser failed:", delErr.message);
    process.exit(1);
  }

  console.log("\nDeleted auth user (related public rows cascade).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
