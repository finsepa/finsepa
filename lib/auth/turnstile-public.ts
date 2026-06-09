/** Public Turnstile site key (browser). Secret stays server-only. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);

/** Manual override — hide Turnstile on localhost (login uses `/api/auth/local-password-login` in dev). */
export const TURNSTILE_SKIP_LOCAL =
  process.env.NEXT_PUBLIC_AUTH_SKIP_TURNSTILE_LOCAL === "1" ||
  process.env.NEXT_PUBLIC_AUTH_SKIP_TURNSTILE_LOCAL === "true";

export function isLocalDevHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** Skip Turnstile in the browser on localhost during `next dev` (production builds unchanged). */
export function shouldBypassTurnstileOnClient(): boolean {
  if (TURNSTILE_SKIP_LOCAL) return true;
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  return isLocalDevHostname(window.location.hostname);
}
