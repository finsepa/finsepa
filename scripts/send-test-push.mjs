#!/usr/bin/env node
/**
 * Send a test APNs alert to every registered device for one user (by email).
 * Also inserts a matching in-app notification row.
 *
 * Requires in .env.local (or Vercel production):
 *   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (or APNS_AUTH_KEY_P8)
 *   SUPABASE_POOLER_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-test-push.mjs rakshamann@gmail.com
 *   node --env-file=.env.local scripts/send-test-push.mjs --email rakshamann@gmail.com --ticker AAPL
 */

import crypto from "node:crypto";
import http2 from "node:http2";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

const emailArg =
  process.argv.find((a, i) => process.argv[i - 1] === "--email")?.trim().toLowerCase() ||
  process.argv[2]?.trim().toLowerCase() ||
  null;
const tickerArg =
  process.argv.find((a, i) => process.argv[i - 1] === "--ticker")?.trim().toUpperCase() || "TEST";

function loadApnsConfig() {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.finsepa.app";
  const privateKeyRaw =
    process.env.APNS_PRIVATE_KEY?.trim() || process.env.APNS_AUTH_KEY_P8?.trim();
  if (!keyId || !teamId || !privateKeyRaw) return null;

  let privateKeyPem = privateKeyRaw.includes("BEGIN PRIVATE KEY")
    ? privateKeyRaw
    : Buffer.from(privateKeyRaw, "base64").toString("utf8");
  privateKeyPem = privateKeyPem.replace(/\\n/g, "\n");

  return { keyId, teamId, bundleId, privateKeyPem };
}

function makeApnsJwt(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId })).toString(
    "base64url",
  );
  const claims = Buffer.from(JSON.stringify({ iss: config.teamId, iat: now })).toString(
    "base64url",
  );
  const unsigned = `${header}.${claims}`;
  const key = crypto.createPrivateKey(config.privateKeyPem);
  const signature = crypto.sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

function apnsHost(environment) {
  return environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

async function sendOneApns(config, device, payload) {
  const jwt = makeApnsJwt(config);
  const host = apnsHost(device.environment);
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "mutable-content": 1,
    },
    kind: payload.kind,
    ticker: payload.ticker,
    notificationId: payload.notificationId,
  });

  return await new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      resolve({ ok: false, status: 0, reason: err.message });
      try {
        client.close();
      } catch {
        /* ignore */
      }
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${device.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let responseStatus = 0;
    let responseBody = "";
    req.setEncoding("utf8");
    req.on("response", (headers) => {
      responseStatus = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      try {
        client.close();
      } catch {
        /* ignore */
      }
      if (responseStatus >= 200 && responseStatus < 300) {
        resolve({ ok: true, status: responseStatus });
        return;
      }
      let reason;
      try {
        reason = JSON.parse(responseBody).reason;
      } catch {
        reason = responseBody || undefined;
      }
      resolve({ ok: false, status: responseStatus, reason });
    });
    req.end(body);
  });
}

async function main() {
  if (!emailArg) {
    console.error("Usage: node --env-file=.env.local scripts/send-test-push.mjs <email>");
    process.exit(1);
  }

  const databaseUrl = resolveSupabaseDatabaseUrl();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!databaseUrl || !supabaseUrl || !serviceKey) {
    console.error("Missing Supabase env (POOLER_URL, NEXT_PUBLIC_SUPABASE_URL, SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  const apns = loadApnsConfig();
  if (!apns) {
    console.error(
      "Missing APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY (or APNS_AUTH_KEY_P8).",
    );
    console.error(
      "Create an APNs key in Apple Developer → Keys, then add vars to .env.local and Vercel production.",
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const userRes = await client.query(
      "SELECT id, email FROM auth.users WHERE lower(email) = $1 LIMIT 1",
      [emailArg],
    );
    const user = userRes.rows[0];
    if (!user) {
      console.error(`No auth user for ${emailArg}`);
      process.exit(1);
    }

    const tokensRes = await client.query(
      `SELECT token, platform, environment, updated_at
       FROM public.device_push_tokens
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [user.id],
    );
    const devices = tokensRes.rows;
    console.log(`User: ${user.email} (${user.id})`);
    console.log(`Registered devices: ${devices.length}`);
    if (devices.length === 0) {
      console.error(
        "\nNo device tokens yet. On TestFlight: Account → Notifications → Earnings alert ON, allow iOS permission, stay signed in.",
      );
      process.exit(1);
    }

    const title = `${tickerArg} — Finsepa test push`;
    const body = "If you see this banner, APNs is working.";
    const href = `/stock/${encodeURIComponent(tickerArg)}?tab=earnings`;
    const dedupeKey = `TEST_PUSH:${Date.now()}`;

    const ins = await client.query(
      `INSERT INTO public.user_notifications
        (user_id, kind, ticker, title, body, href, payload, dedupe_key)
       VALUES ($1, 'earnings_released', $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id`,
      [
        user.id,
        tickerArg,
        title,
        body,
        href,
        JSON.stringify({ ticker: tickerArg, test: true, href }),
        dedupeKey,
      ],
    );
    const notificationId = ins.rows[0]?.id;
    console.log(`In-app notification: ${notificationId}`);

    let sent = 0;
    let failed = 0;
    for (const device of devices) {
      const prefix = `${device.environment}/${device.platform}`;
      const result = await sendOneApns(apns, device, {
        title,
        body,
        ticker: tickerArg,
        kind: "earnings_released",
        notificationId,
      });
      if (result.ok) {
        sent += 1;
        console.log(`✓ ${prefix} HTTP ${result.status}`);
      } else {
        failed += 1;
        console.error(`✗ ${prefix} HTTP ${result.status} ${result.reason ?? ""}`);
      }
    }

    console.log(`\nDone — push sent: ${sent}, failed: ${failed}`);
    if (sent === 0) process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
