/** Shared display helpers for economy calendar metrics (no server-only). */

function trimTrailingZeros(s: string): string {
  const t = s.replace(/\.?0+$/, "");
  return t === "" ? "0" : t;
}

export function formatEconomyMetric(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimTrailingZeros((n / 1_000_000).toFixed(2))}M`;
  if (abs >= 10_000) return `${trimTrailingZeros((n / 1000).toFixed(2))}K`;
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  if (!Number.isInteger(n)) return `${trimTrailingZeros(n.toFixed(2))}%`;
  return String(n);
}

/** Maps ISO 3166-1 alpha-2 to regional-indicator pair (fallback blank). */
export function countryFlagEmoji(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  const cp = [...cc].map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cp);
}

export type EconomyTimezoneOption = { id: string; label: string; offsetMinutes: number };

/** Preset offsets matching the design (“UTC +4” style); minutes east of UTC. */
export const ECONOMY_TIMEZONE_OPTIONS: readonly EconomyTimezoneOption[] = [
  { id: "utc", label: "UTC", offsetMinutes: 0 },
  { id: "utc+1", label: "UTC +1", offsetMinutes: 60 },
  { id: "utc+2", label: "UTC +2", offsetMinutes: 120 },
  { id: "utc+3", label: "UTC +3", offsetMinutes: 180 },
  { id: "utc+4", label: "UTC +4", offsetMinutes: 240 },
  { id: "utc-5", label: "UTC −5", offsetMinutes: -300 },
  { id: "utc-8", label: "UTC −8", offsetMinutes: -480 },
];

export function formatEconomyClockUtc(ms: number, offsetMinutes: number): string {
  const shifted = ms + offsetMinutes * 60_000;
  const d = new Date(shifted);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  const h12 = hh % 12 || 12;
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${String(h12)}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** Long weekday heading for list section headers (UTC calendar day). */
export function formatEconomyLongDateUtc(ymd: string): string {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return ymd;
  return new Date(t).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
