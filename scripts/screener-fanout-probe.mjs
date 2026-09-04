/**
 * Simulate N concurrent screener/markets readers; assert shared snapshot (≈0 EODHD on fan-out).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   BASE_URL=http://localhost:3000 node scripts/screener-fanout-probe.mjs
 *   BASE_URL=http://localhost:3000 USERS=100 node scripts/screener-fanout-probe.mjs
 */
const secret = process.env.CRON_SECRET?.trim();
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const users = Math.min(200, Math.max(2, Number(process.env.USERS ?? "100") || 100));

if (!secret) {
  console.error("Missing CRON_SECRET");
  process.exit(1);
}

const url = `${base}/api/cron/eodhd-traffic-probe?fanout=${users}`;
console.log("GET", url);

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error(`Non-JSON (${res.status}):`, text.slice(0, 800));
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));

if (!res.ok || !json.pass) {
  console.error("\nFAIL — fan-out not snapshot-safe (see notes).");
  process.exit(1);
}

console.log(`\nPASS — ${json.users} users shared fingerprint; fanout EODHD HTTP=${json.fanoutTrace?.eodhdHttp ?? "?"}`);
