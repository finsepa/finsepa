#!/usr/bin/env node
/**
 * Links the local Supabase CLI to the remote Finsepa project.
 * Requires: `supabase login` (or SUPABASE_ACCESS_TOKEN) + SUPABASE_DB_PASSWORD in env.
 */
import { execFileSync } from "node:child_process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim() ?? "";

const refMatch = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
const projectRef = refMatch?.[1] ?? "";

if (!projectRef) {
  console.error("Missing or invalid NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

if (!password) {
  console.error("Missing SUPABASE_DB_PASSWORD (database password for supabase link).");
  process.exit(1);
}

const supabaseBin = process.env.SUPABASE_BIN?.trim() || "supabase";

try {
  execFileSync(
    supabaseBin,
    ["link", "--project-ref", projectRef, "--password", password, "--yes"],
    {
      stdio: "inherit",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    },
  );
  console.log(`Linked Supabase CLI to project ${projectRef}.`);
} catch {
  process.exit(1);
}
