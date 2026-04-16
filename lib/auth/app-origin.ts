/**
 * Canonical public origin for auth redirects (Supabase `redirect_to`, `emailRedirectTo`, Loops confirmation links).
 * Set `NEXT_PUBLIC_APP_ORIGIN` in production (e.g. https://app.finsepa.com) so links are never derived from a wrong
 * browser origin (http, apex domain, or missing `/auth/callback` path — path is appended by callers).
 * Local dev: omit it and use `window.location.origin` on the client; server falls back to the request body origin.
 */
function normalizeOrigin(raw: string | undefined | null): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/$/, "");
}

export function getAuthAppOriginFromEnv(): string | undefined {
  const k = "NEXT" + "_" + "PUBLIC" + "_" + "APP" + "_" + "ORIGIN";
  const raw = typeof process !== "undefined" && process.env ? process.env[k] : undefined;
  const v = normalizeOrigin(raw);
  return v || undefined;
}

/** Client: env first, then `window.location.origin`. */
export function getAuthAppOriginForClient(): string {
  const fromEnv = getAuthAppOriginFromEnv();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Server (e.g. signup-with-loops): env wins over client-provided origin. */
export function resolveAuthAppOriginForServer(requestAppOrigin: string): string {
  const fromEnv = getAuthAppOriginFromEnv();
  if (fromEnv) return fromEnv;
  return normalizeOrigin(requestAppOrigin);
}
