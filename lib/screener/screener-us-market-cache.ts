import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET_LIVE } from "@/lib/data/cache-policy";
import { isUsEquityExchangeHolidayYmd } from "@/lib/market/us-equity-exchange-holidays";
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

/** Previous NY trading day (skips Sat/Sun and full exchange holidays), up to 14 days back. */
export function previousNyTradingDayYmd(now: Date): string {
  let cursor = now;
  for (let i = 0; i < 14; i++) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    const wd = nyWeekdayShort(cursor);
    if (wd === "Sat" || wd === "Sun") continue;
    const ymd = nyCalendarYmd(cursor);
    if (isUsEquityExchangeHolidayYmd(ymd)) continue;
    return ymd;
  }
  return nyCalendarYmd(now);
}

/**
 * Trading day whose **regular close** should be shown when quotes are frozen
 * (pre-market, post-market, overnight, weekends, exchange holidays).
 */
export function getUsEquityLastRegularSessionYmd(now: Date): string {
  const session = getUsEquityMarketSession(now);
  const todayYmd = nyCalendarYmd(now);
  // Holidays are `closed` — never treat the holiday calendar day as the last regular session.
  if (isUsEquityExchangeHolidayYmd(todayYmd)) return previousNyTradingDayYmd(now);
  if (session === "regular" || session === "post") return todayYmd;
  return previousNyTradingDayYmd(now);
}

export function isScreenerUsMarketLiveSession(now: Date = new Date()): boolean {
  return getUsEquityMarketSession(now) === "regular";
}

/**
 * Screener US market data cache window:
 * - **regular** (9:30–16:00 ET): refresh every 15m, one shared snapshot per slot for all users.
 * - **pre / post / closed / exchange holidays**: freeze until next regular session; segment keyed by last regular close day.
 */
export function getScreenerUsMarketCacheEpoch(now: Date = new Date()): ScreenerUsMarketCacheEpoch {
  const todayYmd = nyCalendarYmd(now);
  const lastRegularSessionYmd = getUsEquityLastRegularSessionYmd(now);

  // Belt-and-suspenders: never write/read live 15m slots on full exchange holidays
  // even if session helpers regress to "regular".
  if (isUsEquityExchangeHolidayYmd(todayYmd)) {
    return {
      mode: "frozen",
      lastRegularSessionYmd,
      segment: `frozen-${lastRegularSessionYmd}`,
      revalidateSec: false,
    };
  }

  const session = getUsEquityMarketSession(now);

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
    return {
      mode: "live",
      lastRegularSessionYmd,
      segment: `live-${todayYmd}-s${Math.max(0, slot)}`,
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
type ScreenerSessionMemEntry = { value: unknown; expiresAt: number };

/** Survives dev reloads where Next `unstable_cache` may not dedupe hard refreshes. */
const screenerUsSessionMem = new Map<string, ScreenerSessionMemEntry>();
const SCREENER_US_SESSION_MEM_MAX = 512;

function screenerSessionMemTtlMs(epoch: ScreenerUsMarketCacheEpoch): number {
  if (epoch.revalidateSec === false) return 24 * 60 * 60 * 1000;
  return epoch.revalidateSec * 1000;
}

function readScreenerSessionMem<T>(key: string): T | undefined {
  const hit = screenerUsSessionMem.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    screenerUsSessionMem.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function writeScreenerSessionMem(key: string, value: unknown, ttlMs: number): void {
  if (screenerUsSessionMem.size >= SCREENER_US_SESSION_MEM_MAX) {
    const oldest = screenerUsSessionMem.keys().next().value;
    if (oldest) screenerUsSessionMem.delete(oldest);
  }
  screenerUsSessionMem.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function withScreenerUsMarketCache<T>(
  baseKey: string,
  loader: () => Promise<T>,
  extraKeyParts: string[] = [],
  now: Date = new Date(),
): Promise<T> {
  const epoch = getScreenerUsMarketCacheEpoch(now);
  const parts = [baseKey, "us-session-v2", epoch.segment, ...extraKeyParts];
  const memKey = parts.join("\0");
  const ttlMs = screenerSessionMemTtlMs(epoch);

  const memHit = readScreenerSessionMem<T>(memKey);
  if (memHit !== undefined) return Promise.resolve(memHit);

  return unstable_cache(
    async () => {
      const again = readScreenerSessionMem<T>(memKey);
      if (again !== undefined) return again;
      const value = await loader();
      writeScreenerSessionMem(memKey, value, ttlMs);
      return value;
    },
    parts,
    { revalidate: epoch.revalidateSec },
  )();
}
