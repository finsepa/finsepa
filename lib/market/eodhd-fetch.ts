import "server-only";

/**
 * Bound outbound EODHD HTTP so a hung provider cannot burn the full serverless
 * budget (same idea as {@link import("@/lib/supabase/auth-fetch-timeout").supabaseAuthTimedFetch}).
 *
 * Call sites should still gate with {@link import("@/lib/market/provider-trace").traceEodhdHttp}
 * before invoking this.
 */
export const EODHD_FETCH_TIMEOUT_MS = 8_000;

/**
 * `fetch` to eodhd.com with an 8s abort. On timeout the promise rejects (typically
 * `TimeoutError` / `AbortError`) — existing call-site `catch` blocks already treat
 * that as empty/null data.
 */
export function fetchEodhd(url: string, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(EODHD_FETCH_TIMEOUT_MS);
  const signal =
    init?.signal != null && typeof AbortSignal.any === "function"
      ? AbortSignal.any([timeout, init.signal])
      : timeout;
  return fetch(url, { ...init, signal });
}
