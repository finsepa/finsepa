import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";

export type UsEquityMarketSession = "pre" | "regular" | "post" | "closed";

/** Stock header / badge: explicit pre-market and “opens soon” overnight copy. */
export type UsEquitySessionBadgeDisplay =
  | { kind: "pre"; minutesUntilRegular: number }
  | { kind: "regular"; minutesUntilClose: number }
  | { kind: "post"; minutesUntilPostEnd: number }
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

/** Stock / Markets session badge copy — `State · Next phase in duration`. */
export function formatUsEquitySessionBadgeLabel(display: UsEquitySessionBadgeDisplay): string {
  switch (display.kind) {
    case "pre_opens_soon":
      return `Market closed · Pre-market in ${formatMinutesShort(display.minutesUntilPre)}`;
    case "pre":
      return `Pre-market · Main session in ${formatMinutesShort(display.minutesUntilRegular)}`;
    case "regular":
      return `Market open · After hours in ${formatMinutesShort(display.minutesUntilClose)}`;
    case "post":
      return `After hours · Market close in ${formatMinutesShort(display.minutesUntilPostEnd)}`;
    case "closed":
      return "Market closed";
  }
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
  if (session === "pre") {
    const regularOpen = 9 * 60 + 30;
    const { dayMinutes } = nyWeekdayAndMinutes(now);
    return { kind: "pre", minutesUntilRegular: Math.max(0, regularOpen - dayMinutes) };
  }
  if (session === "regular") {
    const regularClose = 16 * 60;
    const { dayMinutes } = nyWeekdayAndMinutes(now);
    return { kind: "regular", minutesUntilClose: Math.max(0, regularClose - dayMinutes) };
  }
  if (session === "post") {
    const postEnd = 20 * 60;
    const { dayMinutes } = nyWeekdayAndMinutes(now);
    return { kind: "post", minutesUntilPostEnd: Math.max(0, postEnd - dayMinutes) };
  }

  const { weekdayShort, dayMinutes } = nyWeekdayAndMinutes(now);
  if (weekdayShort === "Sat" || weekdayShort === "Sun") return { kind: "closed" };

  const preStart = 4 * 60;
  if (dayMinutes < preStart) {
    return { kind: "pre_opens_soon", minutesUntilPre: preStart - dayMinutes };
  }
  return { kind: "closed" };
}

/**
 * True when the US equity header may show the pre/post price column — any time except a live
 * regular session (includes weekends, overnight, and US holidays during the 9:30–16:00 ET window).
 */
export function isUsEquityExtendedHoursHeaderEligible(
  now: Date = new Date(),
  liveRegularSessionActive: boolean | null = null,
): boolean {
  const session = getUsEquityMarketSession(now);
  if (session !== "regular") return true;
  return liveRegularSessionActive === false;
}

function nySessionYmdFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nyWeekdayShortFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);
}

/** Unix seconds for the most recent US regular-session close (4:00 PM ET). */
export function lastUsRegularSessionCloseUnix(
  now: Date = new Date(),
  timeZone: string = STOCK_DISPLAY_TZ,
): number {
  const session = getUsEquityMarketSession(now);
  const todayYmd = nySessionYmdFromDate(now);

  if (session === "post") {
    return usSessionWallClockUnix(todayYmd, 16, 0, timeZone);
  }

  const { weekdayShort, dayMinutes } = nyWeekdayAndMinutes(now);
  if (session === "closed" && weekdayShort !== "Sat" && weekdayShort !== "Sun" && dayMinutes >= 20 * 60) {
    return usSessionWallClockUnix(todayYmd, 16, 0, timeZone);
  }

  let cursor = new Date(now.getTime());
  for (let i = 0; i < 10; i++) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    const wd = nyWeekdayShortFromDate(cursor);
    if (wd === "Sat" || wd === "Sun") continue;
    return usSessionWallClockUnix(nySessionYmdFromDate(cursor), 16, 0, timeZone);
  }

  return usSessionWallClockUnix(todayYmd, 16, 0, timeZone);
}

/** Whether today's 9:30–16:00 ET regular session has finished (include today in multi-day charts). */
export function usEquityTodayRegularSessionComplete(now: Date = new Date()): boolean {
  const session = getUsEquityMarketSession(now);
  if (session === "regular" || session === "post") return true;
  if (session !== "closed") return false;
  const { weekdayShort, dayMinutes } = nyWeekdayAndMinutes(now);
  return weekdayShort !== "Sat" && weekdayShort !== "Sun" && dayMinutes >= 20 * 60;
}

/** YYYY-MM-DD for the most recently completed US regular session (1D chart anchor). */
export function lastCompletedUsRegularSessionYmd(
  now: Date = new Date(),
  timeZone: string = STOCK_DISPLAY_TZ,
): string {
  const closeSec = lastUsRegularSessionCloseUnix(now, timeZone);
  return usSessionYmdFromUnixSeconds(closeSec);
}

/** Prior US trading session before `ymd` (skips Sat/Sun; does not know exchange holidays). */
export function previousUsTradingSessionYmd(
  ymd: string,
  timeZone: string = STOCK_DISPLAY_TZ,
): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  let cursor = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  for (let i = 0; i < 12; i++) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(cursor);
    if (wd === "Sat" || wd === "Sun") continue;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
  }
  return ymd;
}
