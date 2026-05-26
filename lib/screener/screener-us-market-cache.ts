import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET_LIVE } from "@/lib/data/cache-policy";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

export type ScreenerUsMarketCacheMode = "live" | "frozen";

export type ScreenerUsMarketCacheEpoch = {
  mode: ScreenerUsMarketCacheMode;
  /** Last completed regular-session trading day (America/New_York), YYYY-MM-DD. */
  lastRegularSessionYmd: string;
  /** `unstable_cache` key segment — shared by all users in the same window. */
  segment: string;
  revalidateSec: number | false;
};

/** Calendar date in America/New_York (YYYY-MM-DD). */
export function nyCalendarYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function nyWeekdayShort(now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
}

/** Previous NY weekday (skips Sat/Sun), up to 10 days back. */
export function previousNyTradingDayYmd(now: Date): string {
  let cursor = now;
  for (let i = 0; i < 10; i++) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    const wd = nyWeekdayShort(cursor);
    if (wd !== "Sat" && wd !== "Sun") return nyCalendarYmd(cursor);
  }
  return nyCalendarYmd(now);
}

/**
 * Trading day whose **regular close** should be shown when quotes are frozen
 * (pre-market, post-market, overnight, weekends).
 */
export function getUsEquityLastRegularSessionYmd(now: Date): string {
  const session = getUsEquityMarketSession(now);
  if (session === "regular" || session === "post") return nyCalendarYmd(now);
  return previousNyTradingDayYmd(now);
}

export function isScreenerUsMarketLiveSession(now: Date = new Date()): boolean {
  return getUsEquityMarketSession(now) === "regular";
}

/**
 * Screener US market data cache window:
 * - **regular** (9:30–16:00 ET): refresh every 15m, one shared snapshot per slot for all users.
 * - **pre / post / closed**: freeze until next regular session; segment keyed by last regular close day.
 */
export function getScreenerUsMarketCacheEpoch(now: Date = new Date()): ScreenerUsMarketCacheEpoch {
  const session = getUsEquityMarketSession(now);
  const lastRegularSessionYmd = getUsEquityLastRegularSessionYmd(now);

  if (session === "regular") {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const dayMinutes = hour * 60 + minute;
    const slot = Math.floor((dayMinutes - 9 * 60 - 30) / 15);
    const ymd = nyCalendarYmd(now);
    return {
      mode: "live",
      lastRegularSessionYmd,
      segment: `live-${ymd}-s${Math.max(0, slot)}`,
      revalidateSec: REVALIDATE_SCREENER_MARKET_LIVE,
    };
  }

  return {
    mode: "frozen",
    lastRegularSessionYmd,
    segment: `frozen-${lastRegularSessionYmd}`,
    revalidateSec: false,
  };
}

/** Cross-user `unstable_cache` keyed by US market session (live 15m bucket or frozen close day). */
export function withScreenerUsMarketCache<T>(
  baseKey: string,
  loader: () => Promise<T>,
  extraKeyParts: string[] = [],
  now: Date = new Date(),
): Promise<T> {
  const epoch = getScreenerUsMarketCacheEpoch(now);
  return unstable_cache(
    loader,
    [baseKey, "us-session-v1", epoch.segment, ...extraKeyParts],
    { revalidate: epoch.revalidateSec },
  )();
}
