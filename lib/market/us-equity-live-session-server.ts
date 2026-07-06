import "server-only";

import { cache } from "react";

import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
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

async function resolveUsEquityLiveRegularSessionActiveImpl(
  ticker: string,
  nowMs: number,
): Promise<boolean> {
  const now = new Date(nowMs);
  if (getUsEquityMarketSession(now) !== "regular") return false;
  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
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
