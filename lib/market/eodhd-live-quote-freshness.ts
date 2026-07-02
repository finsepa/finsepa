import "server-only";

import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import type { EodhdUsQuoteDelayedRow } from "@/lib/market/eodhd-us-quote-delayed";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

/** Max age for a live REST quote during regular hours before we distrust it. */
export const EODHD_LIVE_QUOTE_MAX_AGE_SEC = 180;
/** Fallback display window when the WS minute store is down — still today's session only. */
export const EODHD_LIVE_QUOTE_DISPLAY_MAX_AGE_SEC = 30 * 60;

function tradeUnixSecondsFromMs(ms: number): number {
  return Math.floor(ms / 1000);
}

function isTradeFromTodayRegularSession(tradeSec: number, now: Date, maxAgeSec: number): boolean {
  if (getUsEquityMarketSession(now) !== "regular") return true;

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);

  if (tradeSec < openSec) return false;
  if (tradeSec > closeSec) return false;
  if (maxAgeSec === Number.POSITIVE_INFINITY) return true;
  if (tradeSec > nowSec + 60) return false;
  return nowSec - tradeSec <= maxAgeSec;
}

function isTradeFreshForRegularSession(tradeSec: number, now: Date): boolean {
  return isTradeFromTodayRegularSession(tradeSec, now, EODHD_LIVE_QUOTE_MAX_AGE_SEC);
}

/** True when REST/delayed trade time is any time during today's regular session (screener parity). */
export function isEodhdUsRealtimeFromTodaySession(
  rt: EodhdRealtimePayload | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!rt) return false;
  const ts = rt.timestamp;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
  return isTradeFromTodayRegularSession(Math.floor(ts), now, Number.POSITIVE_INFINITY);
}

export function isEodhdUsQuoteDelayedFromTodaySession(
  row: EodhdUsQuoteDelayedRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.lastTradeTime || !Number.isFinite(row.lastTradeTime)) return false;
  return isTradeFromTodayRegularSession(
    tradeUnixSecondsFromMs(row.lastTradeTime),
    now,
    Number.POSITIVE_INFINITY,
  );
}

/** True when EODHD `/api/real-time` payload is from the current regular session. */
export function isEodhdUsRealtimeFresh(
  rt: EodhdRealtimePayload | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!rt) return false;
  const ts = rt.timestamp;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
  return isTradeFreshForRegularSession(Math.floor(ts), now);
}

/** True when REST is from today but older than {@link EODHD_LIVE_QUOTE_MAX_AGE_SEC} — still usable for display. */
export function isEodhdUsRealtimeAcceptableForDisplay(
  rt: EodhdRealtimePayload | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!rt) return false;
  const ts = rt.timestamp;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
  return isTradeFromTodayRegularSession(Math.floor(ts), now, EODHD_LIVE_QUOTE_DISPLAY_MAX_AGE_SEC);
}

/** True when `us-quote-delayed` last trade is from the current regular session. */
export function isEodhdUsQuoteDelayedFresh(
  row: EodhdUsQuoteDelayedRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.lastTradeTime || !Number.isFinite(row.lastTradeTime)) return false;
  return isTradeFreshForRegularSession(tradeUnixSecondsFromMs(row.lastTradeTime), now);
}

/** Delayed quote acceptable for display when fresh window missed but still today's session. */
export function isEodhdUsQuoteDelayedAcceptableForDisplay(
  row: EodhdUsQuoteDelayedRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.lastTradeTime || !Number.isFinite(row.lastTradeTime)) return false;
  return isTradeFromTodayRegularSession(
    tradeUnixSecondsFromMs(row.lastTradeTime),
    now,
    EODHD_LIVE_QUOTE_DISPLAY_MAX_AGE_SEC,
  );
}
