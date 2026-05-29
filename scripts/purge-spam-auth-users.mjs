#!/usr/bin/env node
/**
 * Delete spam auth users created by bot sign-up floods.
 *
 * Usage (dry run — lists matches only):
 *   node --env-file=.env.local scripts/purge-spam-auth-users.mjs
 *
 * Delete (requires explicit flag):
 *   node --env-file=.env.local scripts/purge-spam-auth-users.mjs --delete
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 */

import { createClient } from "@supabase/supabase-js";

const SPAM_RE =
  /anında|kazan|5000\s*tl|bahis|casino|✨|💰|🎰|telegram\.me|t\.me\//iu;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function isSpamUser(user) {
  const meta = user.user_metadata ?? {};
  const first = String(meta.first_name ?? meta.full_name ?? "").trim();
  const last = String(meta.last_name ?? "").trim();
  const display = String(user.user_metadata?.display_name ?? "").trim();
  const email = String(user.email ?? "").toLowerCase();
  const combined = `${first} ${last} ${display} ${email}`;

  if (SPAM_RE.test(combined)) return true;
  if (EMOJI_RE.test(`${first}${last}${display}`)) return true;

  const local = email.split("@")[0] ?? "";
  if (/^\d{6,}/.test(local) && /@(mail\.com|gmail\.com)$/i.test(email)) return true;
  if (/^[\d._-]+@mail\.com$/i.test(email)) return true;

  return false;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const doDelete = process.argv.includes("--delete");

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let page = 1;
const perPage = 1000;
let scanned = 0;
let matched = 0;
let deleted = 0;
const keepBefore = new Date("2026-05-28T00:00:00.000Z");

console.log(doDelete ? "DELETE mode" : "DRY RUN (pass --delete to remove matches)");

for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  const users = data?.users ?? [];
  if (!users.length) break;

  for (const user of users) {
    scanned += 1;
    const created = user.created_at ? new Date(user.created_at) : null;
    if (created && created < keepBefore) continue;
    if (!isSpamUser(user)) continue;
    matched += 1;
    const label = `${user.email ?? user.id} | ${JSON.stringify(user.user_metadata ?? {}).slice(0, 80)}`;
    if (doDelete) {
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error("delete failed", user.id, delErr.message);
      } else {
        deleted += 1;
        if (deleted % 50 === 0) console.log(`deleted ${deleted}…`);
      }
    } else {
      console.log(label);
    }
  }

  if (users.length < perPage) break;
  page += 1;
}

console.log(`Scanned ${scanned}, matched ${matched}${doDelete ? `, deleted ${deleted}` : ""}.`);
