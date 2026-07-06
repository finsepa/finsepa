import "server-only";

import { unstable_cache } from "next/cache";

import {
  STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC,
  stock1DLiveSessionMinuteBucketUnix,
} from "@/lib/chart/stock-1d-live-session-chart";
import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import {
  usesStock1DLiveWsMinutePipeline,
  usesStock1DLiveWsPostMarketChart,
} from "@/lib/market/stock-1d-live-minute-chart-tickers";
import { fetchStockSessionMinuteBarsFromDb, touchStockSessionMinuteBarWatch } from "@/lib/market/stock-session-minute-bar-store";
import { sessionMinuteBarsNeedsGapFill } from "@/lib/market/stock-ws-priority-universe";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

export type LiveWsMinuteBarCoverage = {
  firstBarTime: number | null;
  lastBarTime: number | null;
  expectedMinutesSinceOpen: number;
  actualBarCount: number;
  coveragePct: number;
};

function inSessionMinuteBars(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date,
): StockChartPoint[] {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, closeSec);
  return bars
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.value > 0 &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);
}

/** Coverage of raw WS minute rows (before forward-fill). */
export function computeLiveWsMinuteBarCoverage(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  now: Date = new Date(),
  timeZone: string = STOCK_DISPLAY_TZ,
): LiveWsMinuteBarCoverage {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, closeSec);
  const inSession = inSessionMinuteBars(bars, sessionYmd, timeZone, now);
  const expectedMinutesSinceOpen =
    endSec >= openSec ? Math.floor((endSec - openSec) / STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC) + 1 : 0;
  const actualBarCount = inSession.length;
  const coveragePct =
    expectedMinutesSinceOpen > 0 ? (actualBarCount / expectedMinutesSinceOpen) * 100 : 0;
  return {
    firstBarTime: inSession[0]?.time ?? null,
    lastBarTime: inSession.at(-1)?.time ?? null,
    expectedMinutesSinceOpen,
    actualBarCount,
    coveragePct,
  };
}

/**
 * Single server normalizer for live 1D charts (allowlist: NVDA, AAPL, QQQ, SPY).
 * Input: raw WS minute rows from Supabase. Output: one forward-filled 1m series for today.
 */
export function normalizeStock1DLiveWsMinuteChartPoints(
  rawBars: readonly StockChartPoint[],
  sessionYmd: string,
  now: Date = new Date(),
  timeZone: string = STOCK_DISPLAY_TZ,
): StockChartPoint[] {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endBucket =
    getUsEquityMarketSession(now) === "regular"
      ? stock1DLiveSessionMinuteBucketUnix(sessionYmd, nowSec, timeZone)
      : closeSec;
  const endSec = Math.min(endBucket, closeSec);
  if (endSec < openSec) return [];

  const byTime = new Map<number, StockChartPoint>();
  for (const p of rawBars) {
    if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value) || p.value <= 0) {
      continue;
    }
    if (p.time < openSec || p.time > closeSec) continue;
    byTime.set(p.time, {
      time: p.time,
      value: p.value,
      sessionDate: sessionYmd,
      timeZone,
    });
  }

  const sorted = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  if (!sorted.length) return [];

  const interval = STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;
  const out: StockChartPoint[] = [];
  let barIdx = 0;
  let lastValue: number | null = null;

  for (let t = openSec; t <= endSec; t += interval) {
    while (barIdx < sorted.length && sorted[barIdx]!.time <= t) {
      lastValue = sorted[barIdx]!.value;
      barIdx++;
    }
    if (lastValue == null) continue;
    out.push({ time: t, value: lastValue, sessionDate: sessionYmd, timeZone });
  }

  return out;
}

async function fetchTodaySessionIntradayMinutePointsUncached(
  ticker: string,
  sessionYmd: string,
  toSec: number,
  timeZone: string = STOCK_DISPLAY_TZ,
): Promise<StockChartPoint[]> {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const cappedTo = Math.min(toSec, closeSec);
  if (cappedTo < openSec) return [];

  const bars = await fetchEodhdIntraday(ticker, openSec, cappedTo, "1m");
  if (!bars?.length) return [];

  const byBucket = new Map<number, StockChartPoint>();
  for (const bar of bars) {
    const value = bar.close;
    if (!Number.isFinite(value) || value <= 0) continue;
    const bucket = stock1DLiveSessionMinuteBucketUnix(sessionYmd, bar.timestamp, timeZone);
    if (bucket < openSec || bucket > closeSec) continue;
    if (usSessionYmdFromUnixSeconds(bucket) !== sessionYmd) continue;
    byBucket.set(bucket, {
      time: bucket,
      value,
      sessionDate: sessionYmd,
      timeZone,
    });
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
}

const getTodaySessionIntradayMinuteBackfill = unstable_cache(
  async (ticker: string, sessionYmd: string, toSec: number) =>
    fetchTodaySessionIntradayMinutePointsUncached(ticker, sessionYmd, toSec),
  ["stock-1d-ws-intraday-backfill-v1"],
  { revalidate: REVALIDATE_HOT },
);

/** REST fills missing buckets; WS rows overwrite on the same bucket_unix. */
export function mergeWsMinuteBarsWithIntradayBackfill(
  wsBars: readonly StockChartPoint[],
  restBars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string = STOCK_DISPLAY_TZ,
): StockChartPoint[] {
  const byTime = new Map<number, StockChartPoint>();
  for (const p of restBars) {
    if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value) || p.value <= 0) {
      continue;
    }
    byTime.set(p.time, {
      time: p.time,
      value: p.value,
      sessionDate: sessionYmd,
      timeZone,
    });
  }
  for (const p of wsBars) {
    if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value) || p.value <= 0) {
      continue;
    }
    byTime.set(p.time, {
      time: p.time,
      value: p.value,
      sessionDate: sessionYmd,
      timeZone,
    });
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function logQqqLiveWsMinuteDebug(
  wsCoverage: LiveWsMinuteBarCoverage,
  mergedCoverage: LiveWsMinuteBarCoverage,
  restBackfillUsed: boolean,
  restBarCount: number,
): void {
  console.info("[live-1d-ws] QQQ", {
    ws: wsCoverage,
    merged: mergedCoverage,
    restBackfillUsed,
    restBarCount,
  });
}

function postMarketRegularSessionNeedsBackfill(
  wsBars: readonly StockChartPoint[],
  sessionYmd: string,
  now: Date,
  timeZone: string = STOCK_DISPLAY_TZ,
): boolean {
  const coverage = computeLiveWsMinuteBarCoverage(wsBars, sessionYmd, now, timeZone);
  return coverage.expectedMinutesSinceOpen > 0 && coverage.coveragePct < 90;
}

/** Live 1D during regular session — Supabase WS bars + optional EODHD 1m backfill, normalized once. */
export async function loadStock1DLiveWsMinuteChartPoints(
  ticker: string,
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const liveRegular = usesStock1DLiveWsMinutePipeline(ticker, now);
  const livePostChart = usesStock1DLiveWsPostMarketChart(ticker, now);
  if (!liveRegular && !livePostChart) return [];

  const sym = ticker.trim().toUpperCase();
  const nowSec = Math.floor(now.getTime() / 1000);
  const sessionYmd = usSessionYmdFromUnixSeconds(nowSec);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  if (liveRegular) {
    void touchStockSessionMinuteBarWatch(sym).catch(() => {});
  }

  const wsBars = await fetchStockSessionMinuteBarsFromDb(sym, sessionYmd);
  const wsCoverage = computeLiveWsMinuteBarCoverage(wsBars, sessionYmd, now);

  const needsBackfill =
    sessionMinuteBarsNeedsGapFill(wsBars, sessionYmd, STOCK_DISPLAY_TZ, now) ||
    (livePostChart && postMarketRegularSessionNeedsBackfill(wsBars, sessionYmd, now));
  let merged = wsBars;
  let restBackfillUsed = false;
  let restBarCount = 0;

  if (needsBackfill) {
    const toSec = Math.min(nowSec, closeSec);
    const restBars = await getTodaySessionIntradayMinuteBackfill(sym, sessionYmd, toSec);
    restBarCount = restBars.length;
    if (restBars.length) {
      merged = mergeWsMinuteBarsWithIntradayBackfill(wsBars, restBars, sessionYmd);
      restBackfillUsed = true;
    }
  }

  if (sym === "QQQ") {
    logQqqLiveWsMinuteDebug(
      wsCoverage,
      computeLiveWsMinuteBarCoverage(merged, sessionYmd, now),
      restBackfillUsed,
      restBarCount,
    );
  }

  return normalizeStock1DLiveWsMinuteChartPoints(merged, sessionYmd, now);
}
