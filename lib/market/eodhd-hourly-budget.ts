import "server-only";

const WINDOW_MS = 60 * 60 * 1000;

/** In-process timestamps of accepted EODHD HTTP requests (rolling hour). */
const timestamps: number[] = [];

function configuredMaxPerHour(): number {
  const raw =
    process.env.FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR?.trim() ??
    process.env.FINSEPA_PROVIDER_MAX_REQUESTS_PER_HOUR?.trim();
  if (raw === undefined || raw === "") return 4000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 4000;
  return n;
}

/**
 * Reserve one slot for an outbound EODHD HTTP request. Returns false when the rolling-hour cap is full.
 *
 * Env: `FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR` or `FINSEPA_PROVIDER_MAX_REQUESTS_PER_HOUR` (default 4000).
 * Per Node instance / serverless isolate — not a global cross-host limit. Pair with long `unstable_cache` TTLs.
 */
export function tryConsumeEodhdRequestSlot(): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  const max = configuredMaxPerHour();
  if (timestamps.length >= max) {
    if (process.env.FINSEPA_PROVIDER_BUDGET_LOG === "1") {
      console.warn(
        `[EODHD budget] hourly cap reached (${max} requests / rolling 60m); blocking further upstream calls until window slides`,
      );
    }
    return false;
  }
  timestamps.push(now);
  return true;
}

/** Introspection for ops (count in current window after prune). */
export function peekEodhdRequestWindow(): { used: number; maxPerHour: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  return { used: timestamps.length, maxPerHour: configuredMaxPerHour() };
}
