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
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/** Allowlist tickers that always emit the `[live-1d-ws]` audit log (not just in dev). */
const STOCK_1D_LIVE_DEBUG_TICKERS = new Set(["AAPL", "NVDA", "QQQ", "SPY"]);

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

/** 1D output bucket size (60s) — the live session x-axis is one point per minute. */
const STOCK_1D_OUTPUT_BUCKET_SEC = STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;

/** EODHD intraday closes for one ticker, bucketed onto the 60s session grid. */
async function fetchStockSessionRestIntradayBucketed(
  ticker: string,
  sessionYmd: string,
  openSec: number,
  closeSec: number,
  toSec: number,
  interval: "1m" | "5m" | "1h",
  timeZone: string = STOCK_DISPLAY_TZ,
): Promise<StockChartPoint[]> {
  const cappedTo = Math.min(toSec, closeSec);
  if (cappedTo < openSec) return [];

  const bars = await fetchEodhdIntraday(ticker, openSec, cappedTo, interval);
  if (!bars?.length) return [];

  const byBucket = new Map<number, StockChartPoint>();
  for (const bar of bars) {
    const value = bar.close;
    if (!Number.isFinite(value) || value <= 0) continue;
    const bucket = stock1DLiveSessionMinuteBucketUnix(sessionYmd, bar.timestamp, timeZone);
    if (bucket < openSec || bucket > closeSec) continue;
    if (usSessionYmdFromUnixSeconds(bucket) !== sessionYmd) continue;
    byBucket.set(bucket, { time: bucket, value, sessionDate: sessionYmd, timeZone });
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
}

export type Stock1DRestBase = {
  points: StockChartPoint[];
  rest1mCount: number;
  rest5mCount: number;
  rest1hCount: number;
};

/**
 * Unconditional REST base for the live 1D chart (allowlist: AAPL, NVDA, QQQ, SPY) — mirrors the
 * BTC pipeline. EODHD intraday lags for the forming session, so blend 5m (reach) + 1m (density,
 * wins on its buckets); fall back to 1h only when both are empty. Cached per (ticker, session) so
 * closed minutes are byte-stable across reloads while fresh WS bars (read uncached) supply the tail.
 */
const getStock1DRestBaseCached = unstable_cache(
  async (ticker: string, sessionYmd: string): Promise<Stock1DRestBase> => {
    const timeZone = STOCK_DISPLAY_TZ;
    const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
    const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
    const toSec = Math.min(Math.floor(Date.now() / 1000), closeSec);

    const [oneMin, fiveMin] = await Promise.all([
      fetchStockSessionRestIntradayBucketed(ticker, sessionYmd, openSec, closeSec, toSec, "1m", timeZone),
      fetchStockSessionRestIntradayBucketed(ticker, sessionYmd, openSec, closeSec, toSec, "5m", timeZone),
    ]);

    // Base = 5m (reach); 1m overwrites its buckets for density (mergeWsMinuteBars: 2nd arg = base, 1st wins).
    let points = mergeWsMinuteBarsWithIntradayBackfill(oneMin, fiveMin, sessionYmd);
    let rest1hCount = 0;
    if (!points.length) {
      const oneHour = await fetchStockSessionRestIntradayBucketed(
        ticker,
        sessionYmd,
        openSec,
        closeSec,
        toSec,
        "1h",
        timeZone,
      );
      rest1hCount = oneHour.length;
      points = oneHour;
    }

    return { points, rest1mCount: oneMin.length, rest5mCount: fiveMin.length, rest1hCount };
  },
  ["stock-1d-rest-base-v1"],
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

type Stock1DBucketedSeries = {
  points: StockChartPoint[];
  realCount: number;
  syntheticCount: number;
};

/**
 * Downsample merged 1m bars to 60s output buckets (latest close per bucket) and emit ONLY real
 * bars — no unbounded interior forward-fill. The series may be extended by at most one synthetic
 * point that duplicates the latest close into the current bucket, and only when the last real bar
 * is exactly the immediately preceding bucket. Mirrors the BTC `buildBucketedSeries` contract so a
 * stale WS store never produces 20–40 minute flat synthetic runs.
 */
function buildStock1DBucketedSeries(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  endSec: number,
  timeZone: string,
): Stock1DBucketedSeries {
  const bucketSec = STOCK_1D_OUTPUT_BUCKET_SEC;
  if (!bars.length) return { points: [], realCount: 0, syntheticCount: 0 };

  const latestByBucket = new Map<number, number>();
  const latestSrcTime = new Map<number, number>();
  for (const p of bars) {
    if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value) || p.value <= 0) {
      continue;
    }
    const bucket = Math.floor(p.time / bucketSec) * bucketSec;
    if (bucket > endSec) continue;
    const prevSrc = latestSrcTime.get(bucket);
    if (prevSrc == null || p.time >= prevSrc) {
      latestSrcTime.set(bucket, p.time);
      latestByBucket.set(bucket, p.value);
    }
  }

  const buckets = Array.from(latestByBucket.keys()).sort((a, b) => a - b);
  const points: StockChartPoint[] = buckets.map((t) => ({
    time: t,
    value: latestByBucket.get(t)!,
    sessionDate: sessionYmd,
    timeZone,
  }));

  const realCount = points.length;
  let syntheticCount = 0;
  if (realCount > 0) {
    const lastReal = points[realCount - 1]!.time;
    const currentBucket = Math.floor(endSec / bucketSec) * bucketSec;
    if (currentBucket === lastReal + bucketSec) {
      points.push({ time: currentBucket, value: points[realCount - 1]!.value, sessionDate: sessionYmd, timeZone });
      syntheticCount = 1;
    }
  }

  return { points, realCount, syntheticCount };
}

function seriesMaxGapSec(points: readonly StockChartPoint[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i += 1) {
    const gap = points[i]!.time - points[i - 1]!.time;
    if (gap > max) max = gap;
  }
  return max;
}

/** Longest run of consecutive equal-value output points (flat segment length). */
function seriesMaxFlatRun(points: readonly StockChartPoint[]): number {
  if (!points.length) return 0;
  let max = 1;
  let run = 1;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i]!.value === points[i - 1]!.value) {
      run += 1;
      if (run > max) max = run;
    } else {
      run = 1;
    }
  }
  return max;
}

/**
 * Live 1D during regular / post-market session (allowlist: AAPL, NVDA, QQQ, SPY).
 *
 * Mirrors the BTC pipeline for determinism: fetch a REST intraday base UNCONDITIONALLY every load
 * (cached per session), merge fresh WS minute bars on top (WS wins on overlapping buckets), then
 * emit real 60s buckets only (no unbounded forward-fill). Closed minutes are byte-stable across
 * reloads, so the intraday history reconstructs the same way each time — like Google Finance.
 */
export async function loadStock1DLiveWsMinuteChartPoints(
  ticker: string,
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const liveRegular = usesStock1DLiveWsMinutePipeline(ticker, now);
  const livePostChart = usesStock1DLiveWsPostMarketChart(ticker, now);
  if (!liveRegular && !livePostChart) return [];

  const sym = ticker.trim().toUpperCase();
  const timeZone = STOCK_DISPLAY_TZ;
  const nowSec = Math.floor(now.getTime() / 1000);
  const sessionYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  if (liveRegular) {
    void touchStockSessionMinuteBarWatch(sym).catch(() => {});
  }

  // Unconditional REST base (cached) + fresh WS bars; WS wins on overlapping buckets.
  const [restBase, wsBars] = await Promise.all([
    getStock1DRestBaseCached(sym, sessionYmd),
    fetchStockSessionMinuteBarsFromDb(sym, sessionYmd),
  ]);

  const merged = mergeWsMinuteBarsWithIntradayBackfill(wsBars, restBase.points, sessionYmd);

  const endBucket =
    getUsEquityMarketSession(now) === "regular"
      ? stock1DLiveSessionMinuteBucketUnix(sessionYmd, nowSec, timeZone)
      : closeSec;
  const endSec = Math.min(endBucket, closeSec);

  const windowed = merged.filter((p) => p.time >= openSec && p.time <= endSec);
  const series = buildStock1DBucketedSeries(windowed, sessionYmd, endSec, timeZone);
  const { points, realCount, syntheticCount } = series;

  if (process.env.NODE_ENV === "development" || STOCK_1D_LIVE_DEBUG_TICKERS.has(sym)) {
    const iso = (sec: number | null | undefined) =>
      sec != null ? new Date(sec * 1000).toISOString() : null;
    console.info("[live-1d-ws]", sym, {
      rest1mCount: restBase.rest1mCount,
      rest5mCount: restBase.rest5mCount,
      rest1hCount: restBase.rest1hCount,
      wsCount: wsBars.length,
      mergedCount: windowed.length,
      outputCount: points.length,
      realCount,
      syntheticCount,
      maxGapSeconds: seriesMaxGapSec(points),
      maxFlatRun: seriesMaxFlatRun(points),
      firstPointTime: iso(points[0]?.time),
      lastPointTime: iso(points.at(-1)?.time),
    });
  }

  return points;
}
