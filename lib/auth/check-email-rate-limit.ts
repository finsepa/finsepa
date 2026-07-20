import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 10;

function take(key: string, max: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= max) return false;
  existing.count += 1;
  return true;
}

/** Best-effort in-memory limiter (per server instance). */
export function allowCheckEmailRequest(ip: string, email: string): boolean {
  const okIp = take(`ip:${ip || "unknown"}`, MAX_PER_IP);
  const okEmail = take(`email:${email}`, MAX_PER_EMAIL);
  return okIp && okEmail;
}
