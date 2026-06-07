#!/usr/bin/env node
/**
 * Loads `.env.local` into the process env, then runs `npm install`.
 * Use when `UNTITLEDUI_NPM_TOKEN` lives in `.env.local` (npm does not read that file itself).
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envLocalPath = ".env.local";
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const result = spawnSync("npm", ["install", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
