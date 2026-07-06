import "server-only";

import {
  formatStockExtendedHoursSessionLabel,
  formatStockHeaderAtClosePeriodLabel,
  STOCK_DISPLAY_TZ,
  usSessionWallClockUnix,
} from "@/lib/market/chart-timestamp-format";
import {
  fetchEodhdUsQuoteDelayed,
  type EodhdUsQuoteDelayedRow,
} from "@/lib/market/eodhd-us-quote-delayed";
import { isUsListedStockHeaderMeta, type StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import { getStockPerformance } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { priorSessionDayChangeFromPerformance } from "@/lib/market/prior-session-day-change";
import {
  getUsEquityMarketSession,
  isUsEquityExtendedHoursHeaderEligible,
  lastUsRegularSessionCloseUnix,
} from "@/lib/market/us-equity-market-session";
import { resolveUsEquityLiveRegularSessionActive } from "@/lib/market/us-equity-live-session-server";

export type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";

function clampFinite(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function positiveUsd(n: unknown): number | null {
  const v = clampFinite(n);
  return v != null && v > 0 ? v : null;
}

function nyDayMinutesFromUnix(sec: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(sec * 1000));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function nyYmdFromUnix(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCK_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

function nyYmdFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCK_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Same NY calendar day, 4:00–9:30 ET. */
function isPreMarketQuoteTime(sec: number, now: Date): boolean {
  if (nyYmdFromUnix(sec) !== nyYmdFromDate(now)) return false;
  const dayMinutes = nyDayMinutesFromUnix(sec);
  return dayMinutes >= 4 * 60 && dayMinutes < 9 * 60 + 30;
}

/** Trades after the prior regular close and before today's 9:30 open (pre-market span). */
function isTodayPreMarketSpan(sec: number, now: Date, regularCloseSec: number): boolean {
  const todayYmd = nyYmdFromDate(now);
  if (nyYmdFromUnix(sec) !== todayYmd) return false;
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  return sec > regularCloseSec && sec < openSec;
}

function resolvePreMarketLiveFallback(
  row: EodhdUsQuoteDelayedRow,
  now: Date,
): { price: number; timeSec: number; session: "pre" } | null {
  const nowSec = Math.floor(now.getTime() / 1000);
  const liveStamp =
    getUsEquityMarketSession(now) === "pre" && isPreMarketQuoteTime(nowSec, now) ? nowSec : null;

  const mid = midBidAskUsd(row);
  if (mid != null) {
    const bidTime = parseProviderTimeSec(row.bidTime);
    const askTime = parseProviderTimeSec(row.askTime);
    let timeSec =
      bidTime != null && askTime != null ? Math.max(bidTime, askTime) : bidTime ?? askTime ?? null;
    if (liveStamp != null) {
      timeSec = liveStamp;
    } else if (timeSec == null || !isPreMarketQuoteTime(timeSec, now)) {
      timeSec = nowSec;
    }
    return { price: mid, timeSec, session: "pre" };
  }

  const eth = positiveUsd(row.ethPrice);
  if (eth != null) {
    const ethSec = parseProviderTimeSec(row.ethTime);
    const timeSec =
      liveStamp ??
      (ethSec != null && isPreMarketQuoteTime(ethSec, now) ? ethSec : nowSec);
    return { price: eth, timeSec, session: "pre" };
  }

  return null;
}

/** During live pre-market, stamp must stay in today's 4:00–9:30 ET window (never regular session). */
function resolvePreMarketDisplayTimeSec(quoteTimeSec: number, now: Date): number {
  const nowSec = Math.floor(now.getTime() / 1000);
  if (getUsEquityMarketSession(now) !== "pre") {
    return isPreMarketQuoteTime(quoteTimeSec, now) ? quoteTimeSec : nowSec;
  }
  if (isPreMarketQuoteTime(nowSec, now)) return nowSec;
  if (isPreMarketQuoteTime(quoteTimeSec, now)) return quoteTimeSec;
  return nowSec;
}

/** Label bucket from the extended quote timestamp (works when wall-clock session is `closed`). */
function inferExtendedHoursSessionFromEthTime(
  ethTsSec: number,
  now: Date,
): "pre" | "post" {
  const dayMinutes = nyDayMinutesFromUnix(ethTsSec);
  const preStart = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;

  if (dayMinutes >= preStart && dayMinutes < regularOpen) return "pre";
  if (dayMinutes >= regularClose) return "post";

  const wall = getUsEquityMarketSession(now);
  return wall === "pre" ? "pre" : "post";
}

function isExtendedHoursQuoteTimeSec(sec: number): boolean {
  const dayMinutes = nyDayMinutesFromUnix(sec);
  const preStart = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  return (dayMinutes >= preStart && dayMinutes < regularOpen) || dayMinutes >= regularClose;
}

/** Regular close immediately before an after-hours print (handles holiday/weekend calendar drift). */
function resolveAtCloseUnixForExtendedQuote(
  live: { timeSec: number; session: "pre" | "post" },
  calendarCloseSec: number,
  timeZone: string = STOCK_DISPLAY_TZ,
): number {
  const dayMinutes = nyDayMinutesFromUnix(live.timeSec);
  const ymd = nyYmdFromUnix(live.timeSec);
  if (live.session === "post" && dayMinutes >= 16 * 60) {
    return usSessionWallClockUnix(ymd, 16, 0, timeZone);
  }
  return calendarCloseSec;
}

/** EODHD timestamps: trade/bid/ask fields are Unix ms; `timestamp` is Unix seconds. */
function parseProviderTimeSec(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value > 1e12) return Math.floor(value / 1000);
  if (value > 1e9) return Math.floor(value);
  return null;
}

function midBidAskUsd(row: EodhdUsQuoteDelayedRow): number | null {
  const bid = positiveUsd(row.bidPrice);
  const ask = positiveUsd(row.askPrice);
  if (bid != null && ask != null) return (bid + ask) / 2;
  return bid ?? ask;
}

/**
 * Freshest extended-hours price + event time from the Live v2 quote row.
 * `ethTime` / `ethPrice` alone can lag hours behind bid/ask updates during post-market.
 */
export function resolveExtendedHoursLiveQuote(
  row: EodhdUsQuoteDelayedRow,
  regularCloseSec: number,
  now: Date,
): { price: number; timeSec: number; session: "pre" | "post" } | null {
  const candidates: { price: number; timeSec: number }[] = [];

  const add = (price: unknown, timeRaw: number | undefined) => {
    const p = positiveUsd(price);
    const t = parseProviderTimeSec(timeRaw);
    if (p == null || t == null) return;
    candidates.push({ price: p, timeSec: t });
  };

  add(row.ethPrice, row.ethTime);
  add(row.lastTradePrice, row.lastTradeTime);

  const bidTime = parseProviderTimeSec(row.bidTime);
  const askTime = parseProviderTimeSec(row.askTime);
  const quoteTime =
    bidTime != null && askTime != null ? Math.max(bidTime, askTime) : bidTime ?? askTime ?? null;
  const quotePrice = midBidAskUsd(row);
  if (quotePrice != null && quoteTime != null) {
    candidates.push({ price: quotePrice, timeSec: quoteTime });
  }

  const snapSec = parseProviderTimeSec(row.timestamp);
  const eth = positiveUsd(row.ethPrice);
  const ethSec = parseProviderTimeSec(row.ethTime);
  if (snapSec != null && eth != null && (ethSec == null || snapSec > ethSec)) {
    candidates.push({ price: eth, timeSec: snapSec });
  }

  const wall = getUsEquityMarketSession(now);
  if (wall === "pre") {
    const mid = midBidAskUsd(row);
    if (mid != null) {
      const nowSec = Math.floor(now.getTime() / 1000);
      if (isPreMarketQuoteTime(nowSec, now)) {
        candidates.push({ price: mid, timeSec: nowSec });
      }
    }
  }

  const post = candidates.filter((c) => c.timeSec > regularCloseSec);
  const pre = candidates.filter((c) => isPreMarketQuoteTime(c.timeSec, now));
  const preSpan = candidates.filter((c) => isTodayPreMarketSpan(c.timeSec, now, regularCloseSec));

  let pool: { price: number; timeSec: number }[];
  if (wall === "pre") {
    pool = pre.length ? pre : preSpan;
    if (!pool.length) {
      return resolvePreMarketLiveFallback(row, now);
    }
  } else if (wall === "post") {
    pool = post;
  } else {
    pool = post.length ? post : pre.length ? pre : preSpan;
    if (!pool.length && wall === "closed") {
      const extended = candidates.filter((c) => isExtendedHoursQuoteTimeSec(c.timeSec));
      if (extended.length) pool = extended;
    }
  }
  if (!pool.length) {
    const eth = positiveUsd(row.ethPrice);
    const ethSec = parseProviderTimeSec(row.ethTime);
    if (eth != null && ethSec != null && isExtendedHoursQuoteTimeSec(ethSec)) {
      return {
        price: eth,
        timeSec: ethSec,
        session: inferExtendedHoursSessionFromEthTime(ethSec, now),
      };
    }
    return null;
  }

  pool.sort((a, b) => b.timeSec - a.timeSec);
  const best = pool[0]!;
  const session =
    wall === "pre" ? "pre" : inferExtendedHoursSessionFromEthTime(best.timeSec, now);
  return {
    price: best.price,
    timeSec: best.timeSec,
    session,
  };
}

/**
 * Today's regular-session close — anchor for extended-hours move (vs prior close on the left column).
 * Never use `previousClosePrice` alone; that is the prior trading day's close.
 */
export function resolveRegularSessionCloseUsd(
  row: EodhdUsQuoteDelayedRow,
  extendedPrice: number,
  performance: StockPerformance | null,
  sessionCloseUsd?: number | null,
): number | null {
  const fromOverride = positiveUsd(sessionCloseUsd);
  if (fromOverride != null) return fromOverride;

  const fromPerf = positiveUsd(performance?.price);
  if (fromPerf != null) return fromPerf;

  const previousClose = positiveUsd(row.previousClosePrice);
  const lastTrade = positiveUsd(row.lastTradePrice);
  const change = clampFinite(row.change);

  if (lastTrade != null && Math.abs(lastTrade - extendedPrice) > 0.0001) {
    return lastTrade;
  }

  if (previousClose != null && change != null) {
    const fromChange = previousClose + change;
    if (fromChange > 0) return fromChange;
  }

  if (lastTrade != null) return lastTrade;
  return previousClose;
}

/** Prior regular-session close — anchor for the left column and pre-market move during pre-market. */
function resolvePriorSessionCloseUsd(
  performance: StockPerformance | null,
  row: EodhdUsQuoteDelayedRow,
  sessionCloseUsd?: number | null,
): number | null {
  const fromOverride = positiveUsd(sessionCloseUsd);
  if (fromOverride != null) return fromOverride;

  const fromPerf = positiveUsd(performance?.price);
  if (fromPerf != null) return fromPerf;

  return positiveUsd(row.previousClosePrice);
}

/**
 * Dual-column header quote outside US regular session (regular close + live extended).
 * Returns null during regular session or non-US listings.
 */
export async function buildStockExtendedHoursHeaderQuote(
  ticker: string,
  performance: StockPerformance | null,
  meta: Pick<StockDetailHeaderMeta, "exchange" | "countryIso"> | null,
  now: Date = new Date(),
  sessionCloseUsd?: number | null,
  liveRegularSessionActive: boolean | null = null,
): Promise<StockExtendedHoursHeader | null> {
  if (!isUsListedStockHeaderMeta(meta)) return null;
  if (!isUsEquityExtendedHoursHeaderEligible(now, liveRegularSessionActive)) return null;

  const row = await fetchEodhdUsQuoteDelayed(ticker);
  if (!row) return null;

  const calendarCloseTs = lastUsRegularSessionCloseUnix(now, STOCK_DISPLAY_TZ);
  const live = resolveExtendedHoursLiveQuote(row, calendarCloseTs, now);
  if (!live) return null;

  const closeTs = resolveAtCloseUnixForExtendedQuote(live, calendarCloseTs, STOCK_DISPLAY_TZ);

  const extendedPrice = live.price;
  const previousClose = positiveUsd(row.previousClosePrice);
  const wallSession = getUsEquityMarketSession(now);

  const closePrice =
    wallSession === "pre"
      ? resolvePriorSessionCloseUsd(performance, row, sessionCloseUsd)
      : resolveRegularSessionCloseUsd(row, extendedPrice, performance, sessionCloseUsd);
  if (closePrice == null) return null;

  // During live post, hide until extended quote moves off the official close.
  // When fully closed (overnight/weekend/holiday), still show the last after-hours print.
  const wallTreatsAsLivePost = wallSession === "post" && liveRegularSessionActive !== false;
  if (wallTreatsAsLivePost && Math.abs(extendedPrice - closePrice) < 0.0001) {
    return null;
  }

  const priorDay =
    priorSessionDayChangeFromPerformance(performance, previousClose) ??
    priorSessionDayChangeFromPerformance(performance, null);

  const closeChangeAbs = priorDay?.changeAbs ?? null;
  const closeChangePct = priorDay?.changePct ?? null;

  const extendedChangeAbs = extendedPrice - closePrice;
  const extendedChangePct = (extendedChangeAbs / closePrice) * 100;

  const session = live.session;
  const extendedTs =
    session === "pre" ? resolvePreMarketDisplayTimeSec(live.timeSec, now) : live.timeSec;

  return {
    session,
    closePrice,
    closeChangeAbs,
    closeChangePct,
    closeTimestampLabel: formatStockHeaderAtClosePeriodLabel(closeTs, STOCK_DISPLAY_TZ),
    extendedPrice,
    extendedChangeAbs,
    extendedChangePct,
    extendedTimeUnix: extendedTs,
    extendedTimestampLabel: formatStockExtendedHoursSessionLabel(session, extendedTs, STOCK_DISPLAY_TZ),
  };
}

/** ~60s client poll — always fetch a fresh provider row (no cross-user quote cache). */
export async function getStockExtendedHoursQuoteForApi(
  ticker: string,
  meta: Pick<StockDetailHeaderMeta, "exchange" | "countryIso"> | null,
  sessionCloseUsd?: number | null,
): Promise<StockExtendedHoursHeader | null> {
  if (!isUsListedStockHeaderMeta(meta)) return null;
  const now = new Date();
  const sym = ticker.trim().toUpperCase();
  const liveRegularSessionActive = await resolveUsEquityLiveRegularSessionActive(sym, now);
  if (!isUsEquityExtendedHoursHeaderEligible(now, liveRegularSessionActive)) return null;
  const performance = await getStockPerformance(sym);
  return buildStockExtendedHoursHeaderQuote(
    sym,
    performance,
    meta,
    now,
    sessionCloseUsd,
    liveRegularSessionActive,
  );
}
