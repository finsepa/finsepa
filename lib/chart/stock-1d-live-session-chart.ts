import type { IChartApi, UTCTimestamp } from "lightweight-charts";

import { fitContentWithMobilePlotGutter, mobileTimeScaleOptions } from "@/lib/chart/mobile-plot-horizontal-gutter";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

/** US equities 1D live session is always anchored to the NYSE regular-hours clock. */
export const STOCK_1D_LIVE_SESSION_TZ = STOCK_DISPLAY_TZ;

/** Yahoo-style 1D live session: one point every 15 minutes from the 9:30 open. */
export const STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC = 15 * 60;
export function chartPointsLookLikeIntradaySession(points: readonly StockChartPoint[]): boolean {
  const sorted = points
    .filter((p) => typeof p.time === "number" && Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time);
  if (sorted.length < 2) return false;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.time - sorted[i - 1]!.time <= 3600) return true;
  }
  return false;
}

/** 1D stock overview during regular session — pin X-axis to 9:30–16:00 ET; line grows through the day. */
export function shouldUseStock1DLiveSessionChart(
  kind: "stock" | "crypto",
  range: StockChartRange,
  points: readonly StockChartPoint[],
  holdingsStyle: boolean,
  now: Date = new Date(),
): boolean {
  if (holdingsStyle || kind !== "stock" || range !== "1D") return false;
  if (getUsEquityMarketSession(now) === "regular") return true;
  return chartPointsLookLikeIntradaySession(points);
}

export function stock1DLiveSessionYmd(
  points: readonly StockChartPoint[],
  timeZone: string,
): string | null {
  const data = points.filter((p) => typeof p.time === "number" && Number.isFinite(p.time));
  if (!data.length) return null;
  const last = data[data.length - 1]!;
  const sd = last.sessionDate?.trim();
  if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(last.time * 1000));
}

/** During regular hours, pin to today's US session even if stale bars remain in the payload. */
export function resolveStock1DLiveSessionYmd(
  points: readonly StockChartPoint[],
  timeZone: string,
  now: Date = new Date(),
): string | null {
  if (getUsEquityMarketSession(now) === "regular") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
  return stock1DLiveSessionYmd(points, timeZone);
}

export function filterStock1DLiveSessionPoints(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
): StockChartPoint[] {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, close) : close;

  return points.filter((p) => {
    if (typeof p.time !== "number" || !Number.isFinite(p.time)) return false;
    if (p.time < open || p.time > endSec) return false;
    return usSessionYmdFromUnixSeconds(p.time) === sessionYmd;
  });
}

/** Session window filter without `sessionDate` — catches bars when metadata is stale. */
export function filterStock1DLiveSessionPointsByTimeWindow(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string = STOCK_1D_LIVE_SESSION_TZ,
  now: Date = new Date(),
): StockChartPoint[] {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, close) : close;

  return points.filter((p) => {
    if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value)) return false;
    return p.time >= open && p.time <= endSec;
  });
}

function collectStock1DLiveSessionSourcePoints(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date,
): StockChartPoint[] {
  const byYmd = filterStock1DLiveSessionPoints(points, sessionYmd, timeZone, now);
  if (byYmd.length) return byYmd;
  return filterStock1DLiveSessionPointsByTimeWindow(points, sessionYmd, timeZone, now);
}

export function resampleStock1DLiveSessionTo15Min(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  openValue: number,
  now: Date = new Date(),
): StockChartPoint[] {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, close);
  const interval = STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;

  const sorted = points
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);

  if (!sorted.length) return [];

  const out: StockChartPoint[] = [];
  for (let bucketTime = open; bucketTime <= endSec; bucketTime += interval) {
    let value = openValue;
    for (const p of sorted) {
      if (p.time <= bucketTime) value = p.value;
      else break;
    }
    out.push({ time: bucketTime, value, sessionDate: sessionYmd, timeZone });
  }

  if (out.length && endSec > out[out.length - 1]!.time) {
    let tailValue = out[out.length - 1]!.value;
    for (const p of sorted) {
      if (p.time <= endSec) tailValue = p.value;
      else break;
    }
    out.push({ time: endSec, value: tailValue, sessionDate: sessionYmd, timeZone });
  }

  return out;
}

function resolveSessionOpenAnchorValue(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  liveSpotUsd: number | null | undefined,
  now: Date = new Date(),
): number | null {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, close) : close;
  const sorted = points
    .filter((p) => typeof p.time === "number" && Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
  const inSession = sorted.filter((p) => p.time >= open && p.time <= endSec);
  if (inSession.length) return inSession[0]!.value;
  const beforeOpen = sorted.filter((p) => p.time < open);
  const lastBefore = beforeOpen[beforeOpen.length - 1];
  if (lastBefore != null) {
    const sameSessionDay = usSessionYmdFromUnixSeconds(lastBefore.time) === sessionYmd;
    if (getUsEquityMarketSession(now) !== "regular" || sameSessionDay) {
      return lastBefore.value;
    }
  }
  if (liveSpotUsd != null && Number.isFinite(liveSpotUsd) && liveSpotUsd > 0) return liveSpotUsd;
  return sorted.find((p) => Number.isFinite(p.value))?.value ?? null;
}

/** Pin the visible line end to the current wall-clock time (never beyond `now`). */
export function appendLiveSessionNowTail(
  sessionPoints: StockChartPoint[],
  tailValue: number,
  sessionYmd: string,
  timeZone: string,
  now: Date,
): StockChartPoint[] {
  if (!Number.isFinite(tailValue)) return sessionPoints;

  const nowSec = Math.floor(now.getTime() / 1000);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const tailTime = Math.min(nowSec, close);
  const tailPoint: StockChartPoint = {
    time: tailTime,
    value: tailValue,
    sessionDate: sessionYmd,
    timeZone,
  };

  const sorted = [...sessionPoints]
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time <= tailTime,
    )
    .sort((a, b) => a.time - b.time);

  if (!sorted.length) return [tailPoint];

  const last = sorted[sorted.length - 1]!;
  if (last.time === tailTime) {
    return [...sorted.slice(0, -1), { ...last, value: tailValue }];
  }
  if (last.time > tailTime) {
    return [...sorted.filter((p) => p.time < tailTime), tailPoint];
  }
  return [...sorted, tailPoint];
}

/** Client tick interval — advances the live 1D tail when price is unchanged (no API). */
export const STOCK_1D_LIVE_SESSION_CLOCK_TICK_MS = 30_000;

/** Client live-price poll during regular session — aligns with 60s server cache coalescing. */
export const STOCK_1D_LIVE_PRICE_POLL_MS = 60_000;

/** Filter to today's session window, bootstrap when stale, and pin the tail to the latest spot. */
export function prepareStock1DLiveSessionChartPoints(
  points: readonly StockChartPoint[],
  liveSpotUsd: number | null | undefined,
  _timeZone?: string,
  now: Date = new Date(),
): StockChartPoint[] {
  if (getUsEquityMarketSession(now) !== "regular") {
    return [...points];
  }

  const timeZone = STOCK_1D_LIVE_SESSION_TZ;
  const sessionYmd = resolveStock1DLiveSessionYmd(points, timeZone, now);
  if (!sessionYmd) return [...points];

  const sourcePoints = collectStock1DLiveSessionSourcePoints(points, sessionYmd, timeZone, now);
  const openValue = resolveSessionOpenAnchorValue(points, sessionYmd, timeZone, liveSpotUsd, now);
  if (openValue == null || !Number.isFinite(openValue)) {
    return sourcePoints.length ? sourcePoints : [];
  }

  if (!sourcePoints.length) {
    return [];
  }

  let sessionPoints = resampleStock1DLiveSessionTo15Min(
    sourcePoints,
    sessionYmd,
    timeZone,
    openValue,
    now,
  );

  if (!sessionPoints.length) {
    return [];
  }

  const lastResampled = sessionPoints[sessionPoints.length - 1]!;
  const tailValue =
    liveSpotUsd != null && Number.isFinite(liveSpotUsd) && liveSpotUsd > 0
      ? liveSpotUsd
      : lastResampled.value;

  return appendLiveSessionNowTail(sessionPoints, tailValue, sessionYmd, timeZone, now);
}

export type Stock1DLiveSessionLinePoint = { time: UTCTimestamp; value?: number };

export type Stock1DLiveSessionBaselinePoint =
  | { time: UTCTimestamp; value: number }
  | { time: UTCTimestamp };

/** Pad 9:30 open anchor only — future session slots live on the invisible span series. */
export function padStock1DLiveSessionBaselineData(
  data: { time: UTCTimestamp; value: number }[],
  sessionYmd: string,
  openValue: number,
  timeZone: string,
): Stock1DLiveSessionBaselinePoint[] {
  if (!data.length || !Number.isFinite(openValue)) return data;
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone) as UTCTimestamp;
  if (data[0]!.time <= open) return data;
  return [{ time: open, value: openValue }, ...data];
}

/** Invisible helper series — full 15-min session grid through 16:00 for the time scale. */
export function liveSessionSpanWhitespaceData(
  sessionYmd: string,
  timeZone: string,
): Stock1DLiveSessionLinePoint[] {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const interval = STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;
  const out: Stock1DLiveSessionLinePoint[] = [];
  for (let t = openSec; t <= closeSec; t += interval) {
    out.push({ time: t as UTCTimestamp });
  }
  return out;
}

/** Extend 1D intraday series with the latest polled spot at the current wall-clock time. */
export function mergeLiveSpotInto1DSessionPoints(
  points: readonly StockChartPoint[],
  liveSpotUsd: number | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): StockChartPoint[] {
  return prepareStock1DLiveSessionChartPoints(points, liveSpotUsd, timeZone, now);
}

const LIVE_SESSION_RANGE_RETRIES = 24;

export function stock1DLiveSessionWallClockBounds(
  sessionYmd: string,
  timeZone: string,
): { open: number; close: number } {
  return {
    open: usSessionWallClockUnix(sessionYmd, 9, 30, timeZone),
    close: usSessionWallClockUnix(sessionYmd, 16, 0, timeZone),
  };
}

/** Map a session wall-clock unix time to plot X — matches `setVisibleRange(open, close)`. */
export function liveSessionTimeToPlotLeftPx(
  chart: IChartApi,
  unix: number,
  open: number,
  close: number,
): number | null {
  const plotW = chart.timeScale().width();
  if (plotW <= 0 || close <= open) return null;
  const fraction = (unix - open) / (close - open);
  if (!Number.isFinite(fraction)) return null;

  const linear = fraction * plotW;
  const mapped = chart.timeScale().timeToCoordinate(unix as UTCTimestamp);
  if (mapped != null && Number.isFinite(mapped)) {
    // Reject coordinates from an unpinned/fit-content scale — they skew labels vs. the price line.
    if (Math.abs(mapped - linear) <= Math.max(6, plotW * 0.04)) {
      return mapped;
    }
  }
  return linear;
}

export function applyStock1DLiveSessionTimeScale(
  chart: IChartApi,
  sessionYmd: string,
  timeZone: string,
  _logicalPointCount: number,
  onApplied?: () => void,
): void {
  const { open: from, close: to } = stock1DLiveSessionWallClockBounds(sessionYmd, timeZone);

  const apply = (attempt = 0) => {
    const ts = chart.timeScale();
    const plotW = ts.width();
    if (plotW < 12 && attempt < LIVE_SESSION_RANGE_RETRIES) {
      requestAnimationFrame(() => apply(attempt + 1));
      return;
    }

    try {
      ts.setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
    } catch {
      if (attempt < LIVE_SESSION_RANGE_RETRIES) {
        requestAnimationFrame(() => apply(attempt + 1));
        return;
      }
    }

    ts.applyOptions({
      fixLeftEdge: true,
      fixRightEdge: false,
      rightOffset: 0,
      lockVisibleTimeRangeOnResize: true,
      shiftVisibleRangeOnNewBar: false,
      allowShiftVisibleRangeOnWhitespaceReplacement: false,
      minBarSpacing: 0.001,
    });

    try {
      ts.setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
    } catch {
      if (attempt < LIVE_SESSION_RANGE_RETRIES) {
        requestAnimationFrame(() => apply(attempt + 1));
        return;
      }
    }

    if (onApplied) {
      requestAnimationFrame(() => {
        requestAnimationFrame(onApplied);
      });
    }
  };

  apply();
}

export function fitOverviewChartTimeScale(
  chart: IChartApi,
  containerWidthPx: number,
  logicalPointCount: number,
  ctx: {
    kind: "stock" | "crypto";
    range: StockChartRange;
    points: readonly StockChartPoint[];
    timeZone: string;
    holdingsStyle: boolean;
  },
  onLiveSessionApplied?: () => void,
): void {
  if (shouldUseStock1DLiveSessionChart(ctx.kind, ctx.range, ctx.points, ctx.holdingsStyle)) {
    const ymd = resolveStock1DLiveSessionYmd(ctx.points, ctx.timeZone);
    if (ymd) {
      applyStock1DLiveSessionTimeScale(
        chart,
        ymd,
        ctx.timeZone,
        logicalPointCount,
        onLiveSessionApplied,
      );
      return;
    }
  }
  chart.timeScale().applyOptions({
    ...mobileTimeScaleOptions(containerWidthPx),
    lockVisibleTimeRangeOnResize: false,
    barSpacing: 6,
    minBarSpacing: 0.5,
  });
  fitContentWithMobilePlotGutter(chart, containerWidthPx, logicalPointCount);
}
