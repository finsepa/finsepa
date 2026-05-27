import "server-only";

const HOUR_WINDOW_MS = 60 * 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** In-process timestamps of accepted EODHD HTTP requests (rolling hour). */
const hourlyTimestamps: number[] = [];

/** In-process timestamps of accepted EODHD HTTP requests (rolling 24h). */
const dailyTimestamps: number[] = [];

function configuredMaxPerHour(): number {
  const raw =
    process.env.FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR?.trim() ??
    process.env.FINSEPA_PROVIDER_MAX_REQUESTS_PER_HOUR?.trim();
  if (raw === undefined || raw === "") return 4000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 4000;
  return n;
}

/** When unset, daily cap is disabled. Recommended prod: `80000` (headroom under 100k plan). */
function configuredMaxPerDay(): number | null {
  const raw = process.env.FINSEPA_EODHD_MAX_REQUESTS_PER_DAY?.trim();
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function pruneWindow(timestamps: number[], windowMs: number, now: number): void {
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
}

function tryConsumeInWindow(timestamps: number[], windowMs: number, max: number, now: number): boolean {
  pruneWindow(timestamps, windowMs, now);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  return true;
}

/**
 * Reserve one slot for an outbound EODHD HTTP request. Returns false when the rolling-hour or
 * rolling-day cap is full.
 *
 * Env:
 * - `FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR` / `FINSEPA_PROVIDER_MAX_REQUESTS_PER_HOUR` (default 4000)
 * - `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY` (optional; no daily cap when unset)
 *
 * Per Node instance / serverless isolate — not a global cross-host limit. Pair with snapshots + `unstable_cache`.
 */
export function tryConsumeEodhdRequestSlot(): boolean {
  const now = Date.now();
  const maxDay = configuredMaxPerDay();
  if (maxDay != null) {
    pruneWindow(dailyTimestamps, DAY_WINDOW_MS, now);
    if (dailyTimestamps.length >= maxDay) {
      if (process.env.FINSEPA_PROVIDER_BUDGET_LOG === "1") {
        console.warn(
          `[EODHD budget] daily cap reached (${maxDay} requests / rolling 24h); blocking further upstream calls until window slides`,
        );
      }
      return false;
    }
  }

  const maxHour = configuredMaxPerHour();
  if (!tryConsumeInWindow(hourlyTimestamps, HOUR_WINDOW_MS, maxHour, now)) {
    if (process.env.FINSEPA_PROVIDER_BUDGET_LOG === "1") {
      console.warn(
        `[EODHD budget] hourly cap reached (${maxHour} requests / rolling 60m); blocking further upstream calls until window slides`,
      );
    }
    return false;
  }

  if (maxDay != null) {
    dailyTimestamps.push(now);
  }

  return true;
}

/** Introspection for ops (count in current window after prune). */
export function peekEodhdRequestWindow(): {
  usedHour: number;
  maxPerHour: number;
  usedDay: number;
  maxPerDay: number | null;
} {
  const now = Date.now();
  pruneWindow(hourlyTimestamps, HOUR_WINDOW_MS, now);
  const maxDay = configuredMaxPerDay();
  pruneWindow(dailyTimestamps, DAY_WINDOW_MS, now);
  return {
    usedHour: hourlyTimestamps.length,
    maxPerHour: configuredMaxPerHour(),
    usedDay: dailyTimestamps.length,
    maxPerDay: maxDay,
  };
}
