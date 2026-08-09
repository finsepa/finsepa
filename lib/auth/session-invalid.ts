/**
 * Decide whether an Auth error means the local session is truly dead
 * (safe to clear cookies) vs a transient outage (keep signed in).
 */

const DEFINITIVE_CODES = new Set([
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
  "user_banned",
  "bad_jwt",
  "invalid_jwt",
  "invalid_token",
]);

function asAuthLike(error: unknown): {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
} | null {
  if (!error || typeof error !== "object") return null;
  return error as {
    code?: string;
    message?: string;
    status?: number;
    name?: string;
  };
}

/** Network / Auth outage — do not clear cookies. */
export function isTransientAuthFailure(error: unknown): boolean {
  const e = asAuthLike(error);
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  if (e.status === 502 || e.status === 503 || e.status === 504) return true;
  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("fetch failed")
  ) {
    return true;
  }
  return false;
}

/**
 * True only when Auth says the refresh/session/user is gone.
 * Prefer keeping the session when unsure.
 */
export function isDefinitiveSessionInvalid(error: unknown): boolean {
  if (!error) return false;
  if (isTransientAuthFailure(error)) return false;
  const e = asAuthLike(error);
  if (!e) return false;
  const code = (e.code ?? "").trim().toLowerCase();
  if (code && DEFINITIVE_CODES.has(code)) return true;
  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("session_not_found") ||
    msg.includes("session from session_id claim in jwt does not exist") ||
    msg.includes("user from sub claim in jwt does not exist")
  ) {
    return true;
  }
  return false;
}
