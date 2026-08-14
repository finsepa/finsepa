import "server-only";

import crypto from "node:crypto";
import http2 from "node:http2";

import type { SupabaseClient } from "@supabase/supabase-js";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import type { DevicePushTokenRow } from "@/lib/notifications/device-push-tokens-store";
import { deleteDevicePushTokensByToken } from "@/lib/notifications/device-push-tokens-store";

export type ApnsPushPayload = {
  title: string;
  body: string;
  ticker?: string;
  kind?: string;
  notificationId?: string;
  logoUrl?: string;
};

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyPem: string;
};

function loadApnsConfig(): ApnsConfig | null {
  const keyId = pickProcessEnv("APNS_KEY_ID");
  const teamId = pickProcessEnv("APNS_TEAM_ID");
  const bundleId = pickProcessEnv("APNS_BUNDLE_ID") ?? "com.finsepa.app";
  const privateKeyRaw =
    pickProcessEnv("APNS_PRIVATE_KEY") ?? pickProcessEnv("APNS_AUTH_KEY_P8");
  if (!keyId || !teamId || !privateKeyRaw) return null;

  let privateKeyPem = privateKeyRaw.includes("BEGIN PRIVATE KEY")
    ? privateKeyRaw
    : Buffer.from(privateKeyRaw, "base64").toString("utf8");
  privateKeyPem = privateKeyPem.replace(/\\n/g, "\n");

  return { keyId, teamId, bundleId, privateKeyPem };
}

let cachedJwt: { token: string; exp: number } | null = null;

function makeApnsJwt(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - 60 > now) return cachedJwt.token;

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
  const token = `${unsigned}.${signature.toString("base64url")}`;
  cachedJwt = { token, exp: now + 50 * 60 };
  return token;
}

function apnsHost(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

async function sendOneApns(
  config: ApnsConfig,
  device: DevicePushTokenRow,
  payload: ApnsPushPayload,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const jwt = makeApnsJwt(config);
  const host = apnsHost(device.environment);

  const body = JSON.stringify({
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      "mutable-content": 1,
    },
    kind: payload.kind ?? "earnings_released",
    ticker: payload.ticker ?? null,
    notificationId: payload.notificationId ?? null,
    logoUrl: payload.logoUrl ?? null,
  });

  return await new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      resolve({ ok: false, status: 0, reason: err.message });
      try {
        client.close();
      } catch {
        // ignore
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
        // ignore
      }
      if (responseStatus >= 200 && responseStatus < 300) {
        resolve({ ok: true, status: responseStatus });
        return;
      }
      let reason: string | undefined;
      try {
        reason = (JSON.parse(responseBody) as { reason?: string }).reason;
      } catch {
        reason = responseBody || undefined;
      }
      resolve({ ok: false, status: responseStatus, reason });
    });
    req.end(body);
  });
}

/**
 * Fan-out earnings alerts to registered iOS devices.
 * Soft-fails when APNs env is missing (local/dev without keys).
 */
export async function sendEarningsApnsToDevices(
  admin: SupabaseClient,
  devices: readonly DevicePushTokenRow[],
  payload: ApnsPushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const config = loadApnsConfig();
  if (!config) {
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;
  for (const device of devices) {
    if (device.platform !== "ios") continue;
    const result = await sendOneApns(config, device, payload);
    if (result.ok) {
      sent += 1;
      continue;
    }
    failed += 1;
    if (
      result.status === 410 ||
      result.reason === "Unregistered" ||
      result.reason === "BadDeviceToken"
    ) {
      try {
        await deleteDevicePushTokensByToken(admin, device.token);
      } catch {
        // ignore purge errors
      }
    }
  }
  return { sent, failed, skipped: false };
}
