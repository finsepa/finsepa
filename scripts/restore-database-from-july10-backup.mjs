/**
 * Attempts to restore the Finsepa database from the July 10 nightly backup.
 * Falls back to manual Dashboard steps when the Management API is unavailable.
 *
 * Usage: node scripts/restore-database-from-july10-backup.mjs
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const PROJECT_REF = "pjwzvqvrqqvjgwuouoxy";
const BACKUP_ID = 1084448468;
const BACKUP_TIME = "2026-07-10T22:34:55.592Z";
const DASHBOARD_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/database/backups/scheduled`;

const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const restoreRes = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/backups/restore`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BACKUP_ID }),
  },
);

const restoreBody = await restoreRes.text();
console.log("restore_status", restoreRes.status);
console.log("restore_body", restoreBody);

if (restoreRes.ok) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Database restore started. Watchlist tickers should reappear after restore completes.",
        backupTime: BACKUP_TIME,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      ok: false,
      message:
        "Automatic restore API is unavailable. Restore manually in Supabase Dashboard (rolls back the whole DB to last night).",
      dashboardUrl: DASHBOARD_URL,
      backupId: BACKUP_ID,
      backupTime: BACKUP_TIME,
      steps: [
        "Open the dashboard URL while signed in to Supabase.",
        "Select the backup from July 10, 2026 (~22:34 UTC).",
        "Confirm restore and wait for the project to return to ACTIVE_HEALTHY.",
        "Hard refresh Finsepa (Cmd+Shift+R). Watchlists for rakshamann@gmail.com should return.",
        "Deploy the latest app build so the sync safeguards are live before using watchlists again.",
      ],
    },
    null,
    2,
  ),
);
