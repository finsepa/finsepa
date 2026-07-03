import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

/** Client helper when SSR already computed live-session state server-side. */
export function isUsEquityLiveRegularSession(
  now: Date,
  liveRegularSessionActive: boolean,
): boolean {
  return getUsEquityMarketSession(now) === "regular" && liveRegularSessionActive;
}

/** Header should show at-close + extended-hours columns (not live "Today"). */
export function isUsEquityHeaderAtCloseMode(
  now: Date,
  liveRegularSessionActive: boolean,
): boolean {
  return !isUsEquityLiveRegularSession(now, liveRegularSessionActive);
}
