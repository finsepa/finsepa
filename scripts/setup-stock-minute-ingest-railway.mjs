#!/usr/bin/env node
/**
 * Deploy checklist + optional Railway CLI bootstrap for always-on WS minute ingest.
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-stock-minute-ingest-railway.mjs
 *   node --env-file=.env.local scripts/setup-stock-minute-ingest-railway.mjs --docker-build
 *   node --env-file=.env.local scripts/setup-stock-minute-ingest-railway.mjs --railway-init
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const repoRoot = resolve(import.meta.dirname, "..");

const REQUIRED = [
  "EODHD_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const RECOMMENDED = {
  STOCK_WS_CURATED: "1",
  STOCK_WS_TOP_STOCKS: "48",
  STOCK_WS_WATCHLIST: "0",
  STOCK_WS_SCREENER: "0",
  STOCK_WS_CHART_WATCH: "1",
  STOCK_WS_MAX_SYMBOLS: "50",
  FINSEPA_STOCK_MINUTE_BAR_READ: "1",
  FINSEPA_STOCK_MINUTE_BAR_WRITE: "1",
  FINSEPA_STOCK_TICK_BACKFILL: "1",
};

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

function hasCmd(cmd) {
  return spawnSync("which", [cmd], { encoding: "utf8" }).status === 0;
}

console.log("=== Finsepa always-on stock minute ingest ===\n");

for (const key of REQUIRED) requireEnv(key);
console.log("✓ Required env vars present in .env.local\n");

if (args.has("--docker-build")) {
  console.log("Building Docker image…");
  const dockerfile = "workers/stock-minute-ingest/Dockerfile";
  const res = spawnSync(
    "docker",
    ["build", "-f", dockerfile, "-t", "finsepa-stock-minute-ingest", "."],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (res.status !== 0) process.exit(res.status ?? 1);
  console.log("\n✓ Docker build OK\n");
}

console.log("Railway deploy steps:");
console.log("1. Create a new Railway project → Deploy from GitHub repo");
console.log("2. Service settings:");
console.log("   - Root directory: repo root");
console.log("   - Config file: workers/stock-minute-ingest/railway.toml");
console.log("   - Or Dockerfile path: workers/stock-minute-ingest/Dockerfile");
console.log("3. Set environment variables (copy from .env.local):");
for (const key of REQUIRED) console.log(`   - ${key}`);
for (const [key, val] of Object.entries(RECOMMENDED)) console.log(`   - ${key}=${val}`);
console.log("4. Enable always-on / disable sleep (Railway → Settings → no scale-to-zero)");
console.log("5. Health check path: /health (Railway uses PORT automatically)");
console.log("6. After deploy, set on Vercel (optional monitor):");
console.log("   STOCK_MINUTE_INGEST_HEALTH_URL=https://<your-railway-host>/health");
console.log("7. Verify: npm run stock:minute-ingest:status\n");

console.log("Local smoke test (Ctrl+C to stop): npm run stock:minute-ingest");
console.log("Post-close backfill cron: already on vercel.json (weekdays 03:00 UTC)");
console.log("Manual backfill: npm run stock:tick-backfill\n");

if (args.has("--railway-init")) {
  if (!hasCmd("railway")) {
    console.error("Railway CLI not installed. See https://docs.railway.com/guides/cli");
    process.exit(1);
  }
  if (!existsSync(resolve(repoRoot, "workers/stock-minute-ingest/railway.toml"))) {
    console.error("Missing workers/stock-minute-ingest/railway.toml");
    process.exit(1);
  }
  console.log("Running: railway link (interactive) then railway up …");
  spawnSync("railway", ["link"], { cwd: repoRoot, stdio: "inherit" });
  for (const key of REQUIRED) {
    spawnSync("railway", ["variables", "set", `${key}=${requireEnv(key)}`], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
  for (const [key, val] of Object.entries(RECOMMENDED)) {
    spawnSync("railway", ["variables", "set", `${key}=${val}`], { cwd: repoRoot, stdio: "inherit" });
  }
  spawnSync("railway", ["up"], { cwd: repoRoot, stdio: "inherit" });
}

console.log("Done.");
