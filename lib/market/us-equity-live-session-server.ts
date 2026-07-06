import "server-only";

import { cache } from "react";

import {
  isEodhdUsRealtimeAcceptableForDisplay,
  isEodhdUsRealtimeFresh,
  isEodhdUsRealtimeFromTodaySession,
  isEodhdUsRealtimeOhlcvUsableDuringRegularSession,
} from "@/lib/market/eodhd-live-quote-freshness";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import {
  STOCK_DISPLAY_TZ,
  usSessionWallClockUnix,
  usSessionYmdFromUnixSeconds,
} from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

/** No finalized 1m bars for today after the open — typical on US market holidays. */
async function isTodayUsSessionIntradayAbsentImpl(
  ticker: string,
  todayYmd: string,
  nowSec: number,
  minMinutesSinceOpen: number,
): Promise<boolean> {
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  if (nowSec < openSec + minMinutesSinceOpen * 60) return false;
  const bars = await fetchEodhdIntraday(ticker, openSec, nowSec, "1m");
  return !bars?.length;
}

const isTodayUsSessionIntradayAbsentCached = cache(isTodayUsSessionIntradayAbsentImpl);

export async function isTodayUsSessionIntradayAbsent(
  ticker: string,
  todayYmd: string,
  nowSec: number,
  minMinutesSinceOpen = 15,
): Promise<boolean> {
  return isTodayUsSessionIntradayAbsentCached(ticker, todayYmd, nowSec, minMinutesSinceOpen);
}

function eodhdRealtimeIndicatesLiveRegularSession(
  rt: Awaited<ReturnType<typeof fetchEodhdUsRealtime>>,
  now: Date,
): boolean {
  if (!rt) return false;
  if (isEodhdUsRealtimeFromTodaySession(rt, now)) return true;
  if (isEodhdUsRealtimeFresh(rt, now)) return true;
  if (isEodhdUsRealtimeAcceptableForDisplay(rt, now)) return true;
  // Bogus trade timestamp but valid session OHLCV during the regular clock window.
  return isEodhdUsRealtimeOhlcvUsableDuringRegularSession(rt, now);
}

async function resolveUsEquityLiveRegularSessionActiveImpl(
  ticker: string,
  nowMs: number,
): Promise<boolean> {
  const now = new Date(nowMs);
  if (getUsEquityMarketSession(now) !== "regular") return false;

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);

  const rt = await fetchEodhdUsRealtime(ticker);
  if (eodhdRealtimeIndicatesLiveRegularSession(rt, now)) return true;

  // First ~30m: realtime may lag; do not treat missing REST 1m as a holiday.
  if (nowSec < openSec + 30 * 60) return true;

  // US market holiday: regular clock but no today's session prints (post-open only).
  return !(await isTodayUsSessionIntradayAbsent(ticker, todayYmd, nowSec));
}

const resolveUsEquityLiveRegularSessionActiveCached = cache(
  resolveUsEquityLiveRegularSessionActiveImpl,
);

/** True when US equities are in the regular clock window and today's session has live intraday. */
export async function resolveUsEquityLiveRegularSessionActive(
  ticker: string,
  now: Date = new Date(),
): Promise<boolean> {
  const bucketMs = Math.floor(now.getTime() / 60_000) * 60_000;
  return resolveUsEquityLiveRegularSessionActiveCached(ticker, bucketMs);
}
