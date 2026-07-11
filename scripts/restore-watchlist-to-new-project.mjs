/**
 * Attempts "Restore to a new project" so we can copy watchlist rows without
 * rolling back production.
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
const token = env.SUPABASE_ACCESS_TOKEN;

const attempts = [
  [`/v1/projects/${PROJECT_REF}/database/backups/restore-to-new-project`, { id: BACKUP_ID }],
  [`/v1/projects/${PROJECT_REF}/database/backups/clone`, { id: BACKUP_ID }],
  [`/v1/projects/${PROJECT_REF}/clone`, { backup_id: BACKUP_ID }],
  [
    `/v1/projects/${PROJECT_REF}/database/backups/restore-to-new-project`,
    { id: BACKUP_ID, recovery_time_target: BACKUP_TIME },
  ],
];

for (const [path, body] of attempts) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(path, res.status, text.slice(0, 500));
}
