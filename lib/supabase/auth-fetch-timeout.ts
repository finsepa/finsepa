/**
 * Bound Supabase Auth/network fetches so a Cloudflare 522 / hang cannot burn
 * the full Vercel function budget (25s → Cloudflare 504).
 */
export const SUPABASE_AUTH_FETCH_TIMEOUT_MS = 4_000;

export function supabaseAuthTimedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeout = AbortSignal.timeout(SUPABASE_AUTH_FETCH_TIMEOUT_MS);
  const signal =
    init?.signal != null && typeof AbortSignal.any === "function"
      ? AbortSignal.any([timeout, init.signal])
      : timeout;
  return fetch(input, { ...init, signal });
}
