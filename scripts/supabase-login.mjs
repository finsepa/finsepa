#!/usr/bin/env node
/**
 * Non-interactive Supabase CLI login for Cursor / CI.
 * Set SUPABASE_ACCESS_TOKEN in .env.local (create at supabase.com/dashboard/account/tokens).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const supabaseBin = process.env.SUPABASE_BIN?.trim() || "supabase";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const token =
  process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
  readEnvFile(envPath).SUPABASE_ACCESS_TOKEN?.trim() ||
  "";

if (!token) {
  console.error("Supabase CLI login needs a Personal Access Token (browser OAuth does not work in Cursor's terminal).\n");
  console.error("1. Open https://supabase.com/dashboard/account/tokens");
  console.error('2. Generate new token (name it "Finsepa CLI")');
  console.error("3. Add to .env.local:");
  console.error("   SUPABASE_ACCESS_TOKEN=sbp_...");
  console.error("4. Run: npm run supabase:login\n");

  if (process.platform === "darwin") {
    spawnSync("open", ["https://supabase.com/dashboard/account/tokens"], { stdio: "ignore" });
  }
  process.exit(1);
}

try {
  execFileSync(supabaseBin, ["login", "--token", token], {
    stdio: "inherit",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  });
  console.log("Supabase CLI authenticated.");
} catch {
  process.exit(1);
}
