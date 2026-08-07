type CounterBucket = { count: number; resetAt: number };

const sendHourBuckets = new Map<string, CounterBucket>();
const sendCooldownUntil = new Map<string, number>();
const verifyFailBuckets = new Map<string, CounterBucket>();

const HOUR_MS = 60 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_SEND_PER_EMAIL_HOUR = 10;
const MAX_SEND_PER_IP_HOUR = 30;
const MAX_VERIFY_FAILURES = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

function takeHourly(key: string, max: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = sendHourBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    sendHourBuckets.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { ok: true };
  }
  if (existing.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

/** Best-effort in-memory limiter (per server instance). */
export function allowOtpSend(ip: string, email: string):
  | { ok: true; cooldownSec: number }
  | { ok: false; reason: "cooldown" | "email_limit" | "ip_limit"; retryAfterSec: number } {
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const coolUntil = sendCooldownUntil.get(normalized) ?? 0;
  if (coolUntil > now) {
    return { ok: false, reason: "cooldown", retryAfterSec: Math.max(1, Math.ceil((coolUntil - now) / 1000)) };
  }

  const emailHour = takeHourly(`send-email:${normalized}`, MAX_SEND_PER_EMAIL_HOUR);
  if (!emailHour.ok) {
    return { ok: false, reason: "email_limit", retryAfterSec: emailHour.retryAfterSec };
  }
  const ipHour = takeHourly(`send-ip:${ip || "unknown"}`, MAX_SEND_PER_IP_HOUR);
  if (!ipHour.ok) {
    return { ok: false, reason: "ip_limit", retryAfterSec: ipHour.retryAfterSec };
  }

  sendCooldownUntil.set(normalized, now + SEND_COOLDOWN_MS);
  return { ok: true, cooldownSec: Math.ceil(SEND_COOLDOWN_MS / 1000) };
}

export function allowOtpVerifyAttempt(email: string):
  | { ok: true }
  | { ok: false; retryAfterSec: number } {
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const existing = verifyFailBuckets.get(normalized);
  if (existing && existing.resetAt > now && existing.count >= MAX_VERIFY_FAILURES) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export function recordOtpVerifyFailure(email: string): void {
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const existing = verifyFailBuckets.get(normalized);
  if (!existing || existing.resetAt <= now) {
    verifyFailBuckets.set(normalized, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return;
  }
  existing.count += 1;
}

export function clearOtpVerifyFailures(email: string): void {
  verifyFailBuckets.delete(email.trim().toLowerCase());
}

export const OTP_SEND_COOLDOWN_SEC = Math.ceil(SEND_COOLDOWN_MS / 1000);
