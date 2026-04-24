export type UsEquityMarketSession = "pre" | "regular" | "post" | "closed";

export type UsMarketsHeaderStatus =
  | { variant: "pre"; countdownText: string }
  | { variant: "live" }
  | { variant: "post" }
  | { variant: "closed" };

/** Minutes since midnight in `America/New_York` for {@link now}. */
function nyClockMinutesSinceMidnight(now: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** e.g. `1 hr 42 min`, `45 min` — used for pre-market “open in …” copy (snapshot at {@link now}). */
export function formatMinutesShort(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (safe === 0) return "0 min";
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hr" : `${h} hr`;
  return `${h} hr ${m} min`;
}

/**
 * Snapshot label state for Markets chrome (no ticking clock — recompute on navigation / refresh).
 * Maps {@link getUsEquityMarketSession} to copy + pre-open countdown when in pre-market.
 */
export function getUsMarketsHeaderStatus(now: Date): UsMarketsHeaderStatus {
  const session = getUsEquityMarketSession(now);
  if (session === "regular") return { variant: "live" };
  if (session === "post") return { variant: "post" };
  if (session === "closed") return { variant: "closed" };
  const openM = 9 * 60 + 30;
  const cur = nyClockMinutesSinceMidnight(now);
  return { variant: "pre", countdownText: formatMinutesShort(openM - cur) };
}

/**
 * US equities session in America/New_York (NYSE-style hours, weekdays only).
 * Pre 4:00–9:30, regular 9:30–16:00, post 16:00–20:00; weekends and outside those windows → closed.
 */
export function getUsEquityMarketSession(now: Date): UsEquityMarketSession {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  if (weekday === "Sat" || weekday === "Sun") return "closed";

  const dayMinutes = hour * 60 + minute;
  const preStart = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  const postEnd = 20 * 60;

  if (dayMinutes < preStart || dayMinutes >= postEnd) return "closed";
  if (dayMinutes < regularOpen) return "pre";
  if (dayMinutes < regularClose) return "regular";
  return "post";
}
