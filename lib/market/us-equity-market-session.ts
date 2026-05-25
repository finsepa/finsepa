export type UsEquityMarketSession = "pre" | "regular" | "post" | "closed";

/** Stock header / badge: explicit pre-market and “opens soon” overnight copy. */
export type UsEquitySessionBadgeDisplay =
  | { kind: "pre" }
  | { kind: "regular"; minutesUntilClose: number }
  | { kind: "post" }
  | { kind: "pre_opens_soon"; minutesUntilPre: number }
  | { kind: "closed" };

export type UsMarketsHeaderStatus =
  | { variant: "pre"; countdownText: string }
  | { variant: "live" }
  | { variant: "post" }
  | { variant: "closed" };

function nyWeekdayAndMinutes(now: Date): { weekdayShort: string; dayMinutes: number } {
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
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
  return { weekdayShort, dayMinutes: hour * 60 + minute };
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
  const cur = nyWeekdayAndMinutes(now).dayMinutes;
  return { variant: "pre", countdownText: formatMinutesShort(openM - cur) };
}

/**
 * US equities session in America/New_York (NYSE-style hours, weekdays only).
 * Pre 4:00–9:30, regular 9:30–16:00, post 16:00–20:00; weekends and outside those windows → closed.
 */
export function getUsEquityMarketSession(now: Date): UsEquityMarketSession {
  const { weekdayShort, dayMinutes } = nyWeekdayAndMinutes(now);

  if (weekdayShort === "Sat" || weekdayShort === "Sun") return "closed";

  const preStart = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  const postEnd = 20 * 60;

  if (dayMinutes < preStart || dayMinutes >= postEnd) return "closed";
  if (dayMinutes < regularOpen) return "pre";
  if (dayMinutes < regularClose) return "regular";
  return "post";
}

/**
 * Stock header badge: when pre-market is active, say so explicitly; on weekday
 * overnights before 4:00 AM ET, show time until pre opens (otherwise “closed” reads as “no pre”).
 */
export function getUsEquitySessionBadgeDisplay(now: Date): UsEquitySessionBadgeDisplay {
  const session = getUsEquityMarketSession(now);
  if (session === "pre") return { kind: "pre" };
  if (session === "regular") {
    const regularClose = 16 * 60;
    const { dayMinutes } = nyWeekdayAndMinutes(now);
    return { kind: "regular", minutesUntilClose: Math.max(0, regularClose - dayMinutes) };
  }
  if (session === "post") return { kind: "post" };

  const { weekdayShort, dayMinutes } = nyWeekdayAndMinutes(now);
  if (weekdayShort === "Sat" || weekdayShort === "Sun") return { kind: "closed" };

  const preStart = 4 * 60;
  if (dayMinutes < preStart) {
    return { kind: "pre_opens_soon", minutesUntilPre: preStart - dayMinutes };
  }
  return { kind: "closed" };
}
