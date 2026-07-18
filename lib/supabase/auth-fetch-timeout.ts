/**
 * Bound Supabase Auth network calls so a Cloudflare 522 / hang cannot burn the
 * full Vercel function budget (25s → Cloudflare 504).
 *
 * Only `/auth/v1/*` is timed — PostgREST / storage / realtime keep the default
 * fetch so normal DB queries are not aborted after a few seconds.
 */
export const SUPABASE_AUTH_FETCH_TIMEOUT_MS = 4_000;
/** Browser sign-in / session refresh can wait a bit longer than middleware checks. */
export const SUPABASE_AUTH_BROWSER_FETCH_TIMEOUT_MS = 12_000;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isSupabaseAuthRequest(input: RequestInfo | URL): boolean {
  try {
    return requestUrl(input).includes("/auth/v1/");
  } catch {
    return false;
  }
}

export function supabaseAuthTimedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = SUPABASE_AUTH_FETCH_TIMEOUT_MS,
): Promise<Response> {
  if (!isSupabaseAuthRequest(input)) {
    return fetch(input, init);
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal =
    init?.signal != null && typeof AbortSignal.any === "function"
      ? AbortSignal.any([timeout, init.signal])
      : timeout;
  return fetch(input, { ...init, signal });
}
