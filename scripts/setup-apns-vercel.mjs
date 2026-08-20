#!/usr/bin/env node
/**
 * Add APNs auth key to Vercel (production + preview + development).
 *
 *   node scripts/setup-apns-vercel.mjs --key ~/Downloads/AuthKey_ABC123.p8 --key-id ABC123DEFG
 *
 * Team ID and bundle ID default to Finsepa production values.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const keyPath = process.argv.find((a, i) => process.argv[i - 1] === "--key");
const keyId = process.argv.find((a, i) => process.argv[i - 1] === "--key-id")?.trim();
const teamId =
  process.argv.find((a, i) => process.argv[i - 1] === "--team-id")?.trim() || "985NB96SBH";
const bundleId =
  process.argv.find((a, i) => process.argv[i - 1] === "--bundle-id")?.trim() || "com.finsepa.app";

if (!keyPath || !keyId) {
  console.error(
    "Usage: node scripts/setup-apns-vercel.mjs --key /path/AuthKey_XXXX.p8 --key-id KEYID",
  );
  process.exit(1);
}

const pem = fs.readFileSync(keyPath, "utf8").trim();
if (!pem.includes("BEGIN PRIVATE KEY")) {
  console.error("Expected a .p8 PEM private key file.");
  process.exit(1);
}

const envs = ["production", "preview", "development"];

function addEnv(name, value, env) {
  const res = spawnSync("npx", ["vercel", "env", "add", name, env], {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    console.error(`Failed to add ${name} for ${env} (may already exist — update in Vercel dashboard).`);
  } else {
    console.log(`✓ ${name} → ${env}`);
  }
}

console.log("Adding APNs env to Vercel…");
for (const env of envs) {
  addEnv("APNS_KEY_ID", keyId, env);
  addEnv("APNS_TEAM_ID", teamId, env);
  addEnv("APNS_BUNDLE_ID", bundleId, env);
  addEnv("APNS_PRIVATE_KEY", pem, env);
}

console.log("\nRedeploy production so cron + API pick up the new vars:");
console.log("  npx vercel --prod");
console.log("\nThen register your device token (TestFlight): sign in → allow notifications.");
console.log("  node --env-file=.env.local scripts/send-test-push.mjs rakshamann@gmail.com");
