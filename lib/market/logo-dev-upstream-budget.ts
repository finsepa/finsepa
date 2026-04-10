import "server-only";

/** Rolling 30-day window for Logo.dev **origin** fetches (logo proxy cache misses only). */
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const timestamps: number[] = [];

function configuredMaxPer30d(): number {
  const raw = process.env.FINSEPA_LOGO_DEV_MAX_REQUESTS_PER_30D?.trim();
  if (raw === undefined || raw === "") return 500_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 500_000;
  return n;
}

/**
 * One slot per **upstream** Logo.dev HTTP request (not per browser hit). Pair with `/api/media/logo` + `unstable_cache`.
 *
 * Env: `FINSEPA_LOGO_DEV_MAX_REQUESTS_PER_30D` (default 500_000). Per Node / serverless instance.
 */
export function tryConsumeLogoDevUpstreamSlot(): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  const max = configuredMaxPer30d();
  if (timestamps.length >= max) {
    if (process.env.FINSEPA_PROVIDER_BUDGET_LOG === "1") {
      console.warn(
        `[logo.dev budget] 30d rolling cap reached (${max} upstream fetches); falling back to favicon`,
      );
    }
    return false;
  }
  timestamps.push(now);
  return true;
}

export function peekLogoDevUpstreamWindow(): { used: number; maxPer30d: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  return { used: timestamps.length, maxPer30d: configuredMaxPer30d() };
}
