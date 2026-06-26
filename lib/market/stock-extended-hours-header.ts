import "server-only";

import {
  formatStockExtendedHoursSessionLabel,
  formatStockHeaderAtClosePeriodLabel,
  STOCK_DISPLAY_TZ,
} from "@/lib/market/chart-timestamp-format";
import {
  fetchEodhdUsQuoteDelayed,
  type EodhdUsQuoteDelayedRow,
} from "@/lib/market/eodhd-us-quote-delayed";
import { isUsListedStockHeaderMeta, type StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import { getStockPerformance } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import {
  getUsEquityMarketSession,
  isUsEquityExtendedHoursHeaderEligible,
  lastUsRegularSessionCloseUnix,
} from "@/lib/market/us-equity-market-session";

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

  const post = candidates.filter((c) => c.timeSec > regularCloseSec);
  const pre = candidates.filter((c) => {
    const m = nyDayMinutesFromUnix(c.timeSec);
    return m >= 4 * 60 && m < 9 * 60 + 30;
  });

  const wall = getUsEquityMarketSession(now);
  const pool =
    wall === "pre" ? pre : wall === "post" ? post : post.length ? post : pre;
  if (!pool.length) return null;

  pool.sort((a, b) => b.timeSec - a.timeSec);
  const best = pool[0]!;
  return {
    price: best.price,
    timeSec: best.timeSec,
    session: inferExtendedHoursSessionFromEthTime(best.timeSec, now),
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
 * Returns null during regular session, weekends, or non-US listings.
 */
export async function buildStockExtendedHoursHeaderQuote(
  ticker: string,
  performance: StockPerformance | null,
  meta: Pick<StockDetailHeaderMeta, "exchange" | "countryIso"> | null,
  now: Date = new Date(),
  sessionCloseUsd?: number | null,
): Promise<StockExtendedHoursHeader | null> {
  if (!isUsListedStockHeaderMeta(meta)) return null;
  if (!isUsEquityExtendedHoursHeaderEligible(now)) return null;

  const row = await fetchEodhdUsQuoteDelayed(ticker);
  if (!row) return null;

  const closeTs = lastUsRegularSessionCloseUnix(now, STOCK_DISPLAY_TZ);
  const live = resolveExtendedHoursLiveQuote(row, closeTs, now);
  if (!live) return null;

  const extendedPrice = live.price;
  const previousClose = positiveUsd(row.previousClosePrice);
  const wallSession = getUsEquityMarketSession(now);

  const closePrice =
    wallSession === "pre"
      ? resolvePriorSessionCloseUsd(performance, row, sessionCloseUsd)
      : resolveRegularSessionCloseUsd(row, extendedPrice, performance, sessionCloseUsd);
  if (closePrice == null) return null;

  // Skip when extended quote hasn't moved from the official close.
  if (Math.abs(extendedPrice - closePrice) < 0.0001) return null;

  let closeChangeAbs: number | null = null;
  let closeChangePct: number | null = null;
  if (performance?.d1 != null && Number.isFinite(performance.d1)) {
    closeChangePct = performance.d1;
    if (previousClose != null && previousClose > 0) {
      closeChangeAbs = closePrice - previousClose;
    }
  } else if (previousClose != null && previousClose > 0) {
    closeChangeAbs = closePrice - previousClose;
    closeChangePct = (closeChangeAbs / previousClose) * 100;
  }

  const extendedChangeAbs = extendedPrice - closePrice;
  const extendedChangePct = (extendedChangeAbs / closePrice) * 100;

  const extendedTs = live.timeSec;
  const session = live.session;

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
  if (!isUsEquityExtendedHoursHeaderEligible(new Date())) return null;
  const sym = ticker.trim().toUpperCase();
  const performance = await getStockPerformance(sym);
  return buildStockExtendedHoursHeaderQuote(sym, performance, meta, new Date(), sessionCloseUsd);
}
