#!/usr/bin/env node
/**
 * Trigger Phase 3 tick backfill cron on a deployed or local host.
 *
 * Usage:
 *   CRON_SECRET=… BASE_URL=https://app.finsepa.com npm run stock:tick-backfill
 *   CRON_SECRET=… BASE_URL=http://localhost:3000 npm run stock:tick-backfill -- --sessionYmd=2026-05-27
 */

const args = process.argv.slice(2);
const sessionArg = args.find((a) => a.startsWith("--sessionYmd="));
const sessionYmd = sessionArg ? sessionArg.slice("--sessionYmd=".length) : null;

const secret = process.env.CRON_SECRET?.trim();
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!secret) {
  console.error("Missing CRON_SECRET in environment.");
  process.exit(1);
}

const params = new URLSearchParams();
if (sessionYmd) params.set("sessionYmd", sessionYmd);

const url = `${base}/api/cron/stock-minute-bar-backfill${params.size ? `?${params.toString()}` : ""}`;

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error(`Non-JSON response (${res.status}):`, text.slice(0, 500));
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));
if (!res.ok) process.exit(1);
