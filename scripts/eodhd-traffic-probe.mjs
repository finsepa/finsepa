#!/usr/bin/env node
/**
 * P6 — call GET /api/cron/eodhd-traffic-probe on a deployed host (needs CRON_SECRET).
 *
 * Usage:
 *   CRON_SECRET=… BASE_URL=https://app.finsepa.com npm run eodhd:probe
 *   CRON_SECRET=… BASE_URL=http://localhost:3000 npm run eodhd:probe -- --ingest
 */

const args = process.argv.slice(2);
const runIngest = args.includes("--ingest");
const tickerArg = args.find((a) => a.startsWith("--ticker="));
const ticker = tickerArg ? tickerArg.slice("--ticker=".length) : "AAPL";

const secret = process.env.CRON_SECRET?.trim();
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!secret) {
  console.error("Missing CRON_SECRET in environment.");
  process.exit(1);
}

const params = new URLSearchParams({ ticker });
if (runIngest) params.set("ingest", "1");

const url = `${base}/api/cron/eodhd-traffic-probe?${params.toString()}`;

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

if (!res.ok) {
  console.error(`Probe failed (${res.status}):`, json);
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));
console.log("");
console.log(json.estimatesText ?? "");

const probeTotal = (json.probes ?? []).reduce((sum, p) => sum + (p.eodhdHttp ?? 0), 0);
console.log(`Probe session total (this isolate): ${probeTotal} traced EODHD HTTP calls`);
console.log(`Budget window after probe:`, json.budget);
