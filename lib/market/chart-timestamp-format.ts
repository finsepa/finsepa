/** Default display TZ when API does not provide one: US equities → US market hours context. */
const STOCK_DISPLAY_TZ = "America/New_York";
const CRYPTO_DISPLAY_TZ = "UTC";

function defaultTimeZoneForKind(kind: "stock" | "crypto"): string {
  return kind === "stock" ? STOCK_DISPLAY_TZ : CRYPTO_DISPLAY_TZ;
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
