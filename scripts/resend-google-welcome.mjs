#!/usr/bin/env node
/**
 * Resend Google welcome email for one user (by email).
 *
 *   node --env-file=.env.local scripts/resend-google-welcome.mjs --email user@gmail.com
 */

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const emailArg = process.argv.find((a, i) => process.argv[i - 1] === "--email")?.toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const loopsKey = process.env.LOOPS_API_KEY?.trim();
const txId =
  process.env.LOOPS_TRANSACTIONAL_ID_WELCOME_TRIAL_START?.trim() ||
  process.env.LOOPS_TRANSACTIONAL_ID_GOOGLE_WELCOME?.trim() ||
  "cmpqlacpq1dux0j155z7t77cv";
const poolUrl = process.env.SUPABASE_POOLER_URL?.trim();
const appOrigin =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "") || "https://app.finsepa.com";

if (!emailArg || !url || !key || !loopsKey || !poolUrl) {
  console.error("Need --email, Supabase env, LOOPS_API_KEY, SUPABASE_POOLER_URL.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const client = new pg.Client({ connectionString: poolUrl });
await client.connect();
const { rows } = await client.query(
  "select id, email, raw_user_meta_data from auth.users where lower(email) = lower($1) limit 1",
  [emailArg],
);
await client.end();

const row = rows[0];
if (!row) {
  console.error("No auth user for", emailArg);
  process.exit(1);
}

const meta = row.raw_user_meta_data ?? {};
const firstName =
  (typeof meta.first_name === "string" && meta.first_name.trim()) ||
  (typeof meta.full_name === "string" && meta.full_name.trim().split(/\s+/)[0]) ||
  emailArg.split("@")[0];

const trialEnds = new Date();
trialEnds.setUTCDate(trialEnds.getUTCDate() + 7);
const trialEndsAt = trialEnds.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const body = {
  transactionalId: txId,
  email: emailArg,
  dataVariables: {
    firstName,
    platformLink: `${appOrigin}/screener`,
    confirmationLink: `${appOrigin}/screener`,
    trialDays: 7,
    trialEndsAt,
    proInfoLine:
      "Your free trial includes full platform access for 7 days. Upgrade to Finsepa Pro anytime for ongoing research tools, portfolio tracking, and market data.",
  },
};

const res = await fetch("https://app.loops.so/api/v1/transactional", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${loopsKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("Loops", res.status, text);

console.log(`
If the "Go to Finsepa" button opens a broken URL (e.g. {https://app.finsepa.com/...):
  Loops → Transactional → Welcome to Finsepa → button → Link field
  Change:  {{data.platformLink}  or  {platformLink}
  To:      {data.platformLink}
  Publish the template, then resend this script.
`);

if (res.ok) {
  const { data: u } = await admin.auth.admin.getUserById(row.id);
  const existing = u?.user?.user_metadata ?? {};
  await admin.auth.admin.updateUserById(row.id, {
    user_metadata: {
      ...existing,
      welcome_trial_start_sent_at: new Date().toISOString(),
      google_welcome_email_sent_at: new Date().toISOString(),
    },
  });
  console.log("Marked welcome_trial_start_sent_at for", row.id);
}
