/** Default display TZ when API does not provide one: US equities → US market hours context. */
export const STOCK_DISPLAY_TZ = "America/New_York";
const STOCK_DISPLAY_TZ_INTERNAL = STOCK_DISPLAY_TZ;
const CRYPTO_DISPLAY_TZ = "UTC";

function defaultTimeZoneForKind(kind: "stock" | "crypto"): string {
  return kind === "stock" ? STOCK_DISPLAY_TZ_INTERNAL : CRYPTO_DISPLAY_TZ;
}

const sessionWallClockUnixCache = new Map<string, number>();

/**
 * UNIX seconds for a wall-clock time on a US equity `YYYY-MM-DD` session date (DST-aware via Intl).
 */
export function usSessionWallClockUnix(
  ymd: string,
  hour24: number,
  minute: number,
  timeZone: string = STOCK_DISPLAY_TZ,
): number {
  const cacheKey = `${timeZone}|${ymd}|${hour24}|${minute}`;
  const cached = sessionWallClockUnixCache.get(cacheKey);
  if (cached != null) return cached;

  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const fallback = Math.floor(Date.parse(`${ymd}T12:00:00.000Z`) / 1000);
    sessionWallClockUnixCache.set(cacheKey, fallback);
    return fallback;
  }
  const anchor = Math.floor(Date.UTC(y, m - 1, d, 17, 0, 0) / 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  let resolved = anchor;
  for (let delta = -20 * 3600; delta <= 20 * 3600; delta += 60) {
    const sec = anchor + delta;
    const parts = formatter.formatToParts(new Date(sec * 1000));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    if (
      Number(get("year")) === y &&
      Number(get("month")) === m &&
      Number(get("day")) === d &&
      Number(get("hour")) === hour24 &&
      Number(get("minute")) === minute
    ) {
      resolved = sec;
      break;
    }
  }
  sessionWallClockUnixCache.set(cacheKey, resolved);
  return resolved;
}

function formatDateOnly(unixSeconds: number, timeZone: string): string {
  const d = new Date(unixSeconds * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(d);
}

/** Compact range like Google Finance: "27 Oct 2023–5 Jul 2024". */
export function formatChartSelectionDateRange(
  startUnix: number,
  endUnix: number,
  options: { kind: "stock" | "crypto"; timeZone?: string },
): string {
  const timeZone = options.timeZone ?? defaultTimeZoneForKind(options.kind);
  const fmt = (u: number) => {
    const d = new Date(u * 1000);
    if (!Number.isFinite(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(d);
  };
  const a = fmt(startUnix);
  const b = fmt(endUnix);
  if (!a || !b) return "";
  return `${a}–${b}`;
}

/**
 * Robinhood-style line: "Aug 30, 2024 at 4:00 PM EDT, USD"
 * (no seconds; timezone abbreviation from Intl).
 */
export function formatAssetChartTimestamp(
  unixSeconds: number,
  options: {
    kind: "stock" | "crypto";
    currency?: string;
    /** IANA zone when provided by data; otherwise kind-based default. */
    timeZone?: string;
  },
): string {
  const currency = options.currency ?? "USD";
  const timeZone = options.timeZone ?? defaultTimeZoneForKind(options.kind);
  const d = new Date(unixSeconds * 1000);
  if (!Number.isFinite(d.getTime())) {
    const fallback = formatDateOnly(unixSeconds, timeZone);
    return fallback ? `${fallback}, ${currency}` : currency;
  }

  try {
    const dateStr = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(d);
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone,
    }).format(d);
    const tzName =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "short",
      })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value?.trim() ?? "";
    const core = tzName ? `${dateStr} at ${timeStr} ${tzName}` : `${dateStr} at ${timeStr}`;
    return `${core}, ${currency}`;
  } catch {
    const fallback = formatDateOnly(unixSeconds, timeZone);
    return fallback ? `${fallback}, ${currency}` : currency;
  }
}
