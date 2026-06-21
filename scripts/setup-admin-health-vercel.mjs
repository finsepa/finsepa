#!/usr/bin/env node
/**
 * Push ADMIN_HEALTH_SLUG + ADMIN_HEALTH_PASSWORD to Vercel (Production + Preview + Development).
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-admin-health-vercel.mjs
 *
 * Requires VERCEL_TOKEN (https://vercel.com/account/tokens) in .env.local or the environment.
 * Project ID defaults to Finsepa (`prj_fYsCwgNuSuzxMNRYxy4hmvnS6QG`) or set VERCEL_PROJECT_ID.
 */

const PROJECT_ID = process.env.VERCEL_PROJECT_ID?.trim() || "prj_fYsCwgNuSuzxMNRYxy4hmvnS6QG";
const TOKEN = process.env.VERCEL_TOKEN?.trim();

const KEYS = ["ADMIN_HEALTH_SLUG", "ADMIN_HEALTH_PASSWORD"];
const TARGETS = ["production", "preview", "development"];

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} — set it in .env.local first.`);
  return v;
}

async function listEnvVars() {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List env failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data.envs) ? data.envs : [];
}

async function upsertEnvVar(key, value) {
  const existing = (await listEnvVars()).find((row) => row.key === key);

  if (existing?.id) {
    const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${existing.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value, target: TARGETS, type: "encrypted" }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Update ${key} failed (${res.status}): ${text}`);
    }
    console.log(`Updated ${key} on Vercel (${TARGETS.join(", ")})`);
    return;
  }

  const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: TARGETS,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create ${key} failed (${res.status}): ${text}`);
  }
  console.log(`Created ${key} on Vercel (${TARGETS.join(", ")})`);
}

async function main() {
  if (!TOKEN) {
    throw new Error(
      "Missing VERCEL_TOKEN. Add it to .env.local from https://vercel.com/account/tokens then re-run.",
    );
  }

  for (const key of KEYS) {
    const value = requireEnv(key);
    await upsertEnvVar(key, value);
  }

  const slug = requireEnv("ADMIN_HEALTH_SLUG");
  console.log("\nDone. Redeploy production, then open:");
  console.log(`  https://app.finsepa.com/ops/${slug}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
