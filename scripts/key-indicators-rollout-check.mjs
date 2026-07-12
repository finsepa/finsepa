#!/usr/bin/env node
/**
 * Preflight for Key Indicators rollout (no HTTP).
 * Usage: node --env-file=.env.local scripts/key-indicators-rollout-check.mjs
 */

const REQUIRED = [
  { key: "FINSEPA_KEY_INDICATORS", mustEqual: "1" },
  { key: "NEXT_PUBLIC_FINSEPA_KEY_INDICATORS", mustEqual: "1" },
  { key: "EODHD_API_KEY" },
  { key: "SUPABASE_SERVICE_ROLE_KEY" },
];

const RECOMMENDED = [{ key: "CRON_SECRET" }, { key: "FINSEPA_MARKET_SNAPSHOT_READ", mustEqual: "1", allowUnset: true }];

let failed = false;

function check({ key, mustEqual, allowUnset }) {
  const raw = process.env[key];
  if (allowUnset && (raw == null || raw.trim() === "")) {
    console.log(`○ ${key} (unset — reads default on)`);
    return;
  }
  const val = raw?.trim();
  if (!val) {
    console.error(`✗ ${key} missing`);
    failed = true;
    return;
  }
  if (mustEqual && val !== mustEqual) {
    console.error(`✗ ${key}=${val} (expected ${mustEqual})`);
    failed = true;
    return;
  }
  console.log(`✓ ${key}`);
}

console.log("Key Indicators rollout check\n");

for (const item of REQUIRED) check(item);
for (const item of RECOMMENDED) check(item);

if (failed) {
  console.log("\nFix .env.local, then restart the dev server (both flags must load at startup).");
  process.exit(1);
}

console.log(`
Ready locally:
  1. npm run dev
  2. Sign in → open /stock/NVDA (or AAPL)
  3. Key Indicators card should appear above Key Stats (≥2 lines)

Optional warm (top-500 shard):
  curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/key-indicators-warm?shard=0" | jq

Rule spike (read-only EODHD):
  node --env-file=.env.local scripts/key-indicators-sample-spike.mjs

Production (Vercel):
  - FINSEPA_KEY_INDICATORS=1
  - NEXT_PUBLIC_FINSEPA_KEY_INDICATORS=1
  - Redeploy after setting public flag
  - Cron shards already in vercel.json (4× daily ~125 tickers)
`);
