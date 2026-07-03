import "server-only";

import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import {
  STOCK_DISPLAY_TZ,
  usSessionWallClockUnix,
  usSessionYmdFromUnixSeconds,
} from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

/** No finalized 1m bars for today after the open — typical on US market holidays. */
export async function isTodayUsSessionIntradayAbsent(
  ticker: string,
  todayYmd: string,
  nowSec: number,
  minMinutesSinceOpen = 15,
): Promise<boolean> {
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  if (nowSec < openSec + minMinutesSinceOpen * 60) return false;
  const bars = await fetchEodhdIntraday(ticker, openSec, nowSec, "1m");
  return !bars?.length;
}

/** True when US equities are in the regular clock window and today's session has live intraday. */
export async function resolveUsEquityLiveRegularSessionActive(
  ticker: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (getUsEquityMarketSession(now) !== "regular") return false;
  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  return !(await isTodayUsSessionIntradayAbsent(ticker, todayYmd, nowSec));
}
