import type { IChartApi, UTCTimestamp } from "lightweight-charts";

import { fitContentWithMobilePlotGutter, mobileTimeScaleOptions } from "@/lib/chart/mobile-plot-horizontal-gutter";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import {
  getUsEquityMarketSession,
  isUsEquityExtendedHoursHeaderEligible,
} from "@/lib/market/us-equity-market-session";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

/** US equities 1D live session is always anchored to the NYSE regular-hours clock. */
export const STOCK_1D_LIVE_SESSION_TZ = STOCK_DISPLAY_TZ;

/** 1D live session: one point per minute from the 9:30 open (matches ~60s spot refresh). */
export const STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC = 60;

/** US post-market ends at 8:00 PM ET on the 1D sparkline. */
export const STOCK_1D_EXTENDED_CLOSE_HOUR = 20;

/** After-hours segment line color (no gradient fill). */
export const STOCK_1D_EXTENDED_HOURS_LINE_COLOR = "#64748B";

/** 1D sparkline stops at the regular close — after-hours price is header-only. */
export function shouldUseStock1DExtendedHoursChart(_now: Date = new Date()): boolean {
  return false;
}

export function stock1DLiveSessionExtendedWallClockBounds(
  sessionYmd: string,
  timeZone: string,
): { open: number; regularClose: number; extendedClose: number } {
  return {
    open: usSessionWallClockUnix(sessionYmd, 9, 30, timeZone),
    regularClose: usSessionWallClockUnix(sessionYmd, 16, 0, timeZone),
    extendedClose: usSessionWallClockUnix(sessionYmd, STOCK_1D_EXTENDED_CLOSE_HOUR, 0, timeZone),
  };
}

export function chartPointsIncludeExtendedHoursSegment(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string = STOCK_1D_LIVE_SESSION_TZ,
): boolean {
  const { regularClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  return points.some(
    (p) =>
      typeof p.time === "number" &&
      Number.isFinite(p.time) &&
      Number.isFinite(p.value) &&
      p.time > regularClose,
  );
}
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

/** 1D stock overview — pin X-axis to 9:30–16:00 ET for every US equity ticker. */
export function shouldUseStock1DLiveSessionChart(
  kind: "stock" | "crypto",
  range: StockChartRange,
  _points: readonly StockChartPoint[],
  holdingsStyle: boolean,
  _now: Date = new Date(),
): boolean {
  return !holdingsStyle && kind === "stock" && range === "1D";
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

function lastUsRegularSessionYmdFromPoints(
  points: readonly StockChartPoint[],
  timeZone: string,
): string | null {
  const regular = points
    .filter((p) => typeof p.time === "number" && Number.isFinite(p.time))
    .filter((p) => {
      const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
      const open = usSessionWallClockUnix(ymd, 9, 30, timeZone);
      const close = usSessionWallClockUnix(ymd, 16, 0, timeZone);
      return p.time >= open && p.time <= close;
    })
    .sort((a, b) => a.time - b.time);
  if (!regular.length) return null;
  const last = regular[regular.length - 1]!;
  const sd = last.sessionDate?.trim();
  if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
  return usSessionYmdFromUnixSeconds(last.time);
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
  return lastUsRegularSessionYmdFromPoints(points, timeZone) ?? stock1DLiveSessionYmd(points, timeZone);
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

function collectStock1DLiveSessionPostMarketSourcePoints(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date,
): StockChartPoint[] {
  const { regularClose, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "post" ? Math.min(nowSec, extendedClose) : extendedClose;

  return points
    .filter((p) => {
      if (typeof p.time !== "number" || !Number.isFinite(p.time) || !Number.isFinite(p.value)) return false;
      const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
      return ymd === sessionYmd && p.time > regularClose && p.time <= endSec;
    })
    .sort((a, b) => a.time - b.time);
}

/** Resample post-market bars from the 16:00 close anchor through 20:00 ET (or now during post). */
export function resampleStock1DLiveSessionExtendedSegment(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  anchorValue: number,
  now: Date = new Date(),
): StockChartPoint[] {
  const { regularClose, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "post" ? Math.min(nowSec, extendedClose) : extendedClose;
  if (endSec <= regularClose || !Number.isFinite(anchorValue)) return [];

  const interval = STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;
  const sorted = points
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time > regularClose &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);

  if (!sorted.length) return [];

  const out: StockChartPoint[] = [];
  for (let bucketTime = regularClose; bucketTime <= endSec; bucketTime += interval) {
    let value = anchorValue;
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

function buildMinimalExtendedSegmentFromSpot(
  sessionYmd: string,
  timeZone: string,
  closeValue: number,
  extendedSpotUsd: number,
  now: Date,
  tailTimeUnix?: number,
): StockChartPoint[] {
  const { regularClose, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(
    tailTimeUnix != null && Number.isFinite(tailTimeUnix) ? tailTimeUnix : nowSec,
    extendedClose,
  );
  if (endSec <= regularClose) return [];
  return resampleStock1DLiveSessionExtendedSegment(
    [
      { time: endSec, value: extendedSpotUsd, sessionDate: sessionYmd, timeZone },
    ],
    sessionYmd,
    timeZone,
    closeValue,
    now,
  );
}

/** Pin extended-hours tail at a fixed provider timestamp (frozen post quote). */
export function appendExtendedTailAtTime(
  extendedPoints: StockChartPoint[],
  tailValue: number,
  sessionYmd: string,
  timeZone: string,
  tailTimeUnix: number,
): StockChartPoint[] {
  if (!Number.isFinite(tailValue) || !Number.isFinite(tailTimeUnix)) return extendedPoints;

  const { regularClose, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const tailTime = Math.min(Math.max(tailTimeUnix, regularClose), extendedClose);
  if (tailTime <= regularClose) return extendedPoints;

  const tailPoint: StockChartPoint = {
    time: tailTime,
    value: tailValue,
    sessionDate: sessionYmd,
    timeZone,
  };

  const sorted = [...extendedPoints]
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= regularClose &&
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

/** Pin the after-hours tail to the current wall-clock time (never beyond 20:00 ET). */
export function appendLiveSessionExtendedTail(
  extendedPoints: StockChartPoint[],
  tailValue: number,
  sessionYmd: string,
  timeZone: string,
  now: Date,
): StockChartPoint[] {
  if (!Number.isFinite(tailValue)) return extendedPoints;

  const nowSec = Math.floor(now.getTime() / 1000);
  const { regularClose, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const tailTime = Math.min(nowSec, extendedClose);
  if (tailTime <= regularClose) return extendedPoints;

  const tailPoint: StockChartPoint = {
    time: tailTime,
    value: tailValue,
    sessionDate: sessionYmd,
    timeZone,
  };

  const sorted = [...extendedPoints]
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= regularClose &&
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

export function resampleStock1DLiveSession(
  points: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  openValue: number,
  now: Date = new Date(),
): StockChartPoint[] {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec =
    getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, close) : close;
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

/** Merge polled live spot minute closes into provider bars (live wins on the same minute). */
export function mergeLiveSpotMinuteBarsIntoPoints(
  points: readonly StockChartPoint[],
  liveMinuteBars: readonly StockChartPoint[],
): StockChartPoint[] {
  if (!liveMinuteBars.length) return [...points];
  const byTime = new Map<number, StockChartPoint>();
  for (const p of points) {
    if (typeof p.time === "number" && Number.isFinite(p.time) && Number.isFinite(p.value)) {
      byTime.set(p.time, p);
    }
  }
  for (const p of liveMinuteBars) {
    if (typeof p.time === "number" && Number.isFinite(p.time) && Number.isFinite(p.value)) {
      byTime.set(p.time, p);
    }
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

/** Client live-price poll during regular session — aligns with 60s server cache coalescing. */
export const STOCK_1D_LIVE_PRICE_POLL_MS = 60_000;

/** Snap wall-clock time to the 9:30-anchored 60s bucket used by {@link resampleStock1DLiveSession}. */
export function stock1DLiveSessionMinuteBucketUnix(
  sessionYmd: string,
  nowSec: number,
  timeZone: string = STOCK_1D_LIVE_SESSION_TZ,
): number {
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  if (nowSec <= open) return open;
  const capped = Math.min(nowSec, close);
  const elapsed = capped - open;
  const bucketIndex = Math.floor(elapsed / STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC);
  return open + bucketIndex * STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC;
}

/** One minute close from the latest live spot poll. */
export function liveSpotToMinuteBar(
  liveSpotUsd: number,
  sessionYmd: string,
  now: Date = new Date(),
  timeZone: string = STOCK_1D_LIVE_SESSION_TZ,
): StockChartPoint | null {
  if (!Number.isFinite(liveSpotUsd) || liveSpotUsd <= 0) return null;
  const nowSec = Math.floor(now.getTime() / 1000);
  const bucketTime = stock1DLiveSessionMinuteBucketUnix(sessionYmd, nowSec, timeZone);
  return { time: bucketTime, value: liveSpotUsd, sessionDate: sessionYmd, timeZone };
}

/** Filter to the session window, resample to 1m, and pin the tail (live spot or prior close). */
export function prepareStock1DLiveSessionChartPoints(
  points: readonly StockChartPoint[],
  liveSpotUsd: number | null | undefined,
  _timeZone?: string,
  now: Date = new Date(),
  extendedSpotUsd?: number | null,
  extendedSpotTimeUnix?: number | null,
): StockChartPoint[] {
  const timeZone = STOCK_1D_LIVE_SESSION_TZ;
  const session = getUsEquityMarketSession(now);
  const useLiveSpot = session === "regular";
  const sessionYmd = resolveStock1DLiveSessionYmd(points, timeZone, now);
  if (!sessionYmd) return [...points];

  const sourcePoints = collectStock1DLiveSessionSourcePoints(points, sessionYmd, timeZone, now);
  const openValue = resolveSessionOpenAnchorValue(
    points,
    sessionYmd,
    timeZone,
    useLiveSpot ? liveSpotUsd : null,
    now,
  );
  if (openValue == null || !Number.isFinite(openValue)) {
    return sourcePoints.length ? sourcePoints : [];
  }

  if (!sourcePoints.length) {
    return [];
  }

  const sessionPoints = resampleStock1DLiveSession(
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
    useLiveSpot && liveSpotUsd != null && Number.isFinite(liveSpotUsd) && liveSpotUsd > 0
      ? liveSpotUsd
      : lastResampled.value;

  let regularPoints: StockChartPoint[];
  if (useLiveSpot) {
    regularPoints = appendLiveSessionNowTail(sessionPoints, tailValue, sessionYmd, timeZone, now);
  } else {
    const close = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
    const trimmed = sessionPoints.filter((p) => p.time <= close);
    if (!trimmed.length) {
      regularPoints = [{ time: close, value: tailValue, sessionDate: sessionYmd, timeZone }];
    } else {
      const last = trimmed[trimmed.length - 1]!;
      regularPoints =
        last.time === close
          ? [...trimmed.slice(0, -1), { ...last, value: tailValue }]
          : [...trimmed, { time: close, value: tailValue, sessionDate: sessionYmd, timeZone }];
    }
  }

  if (!shouldUseStock1DExtendedHoursChart(now)) {
    return regularPoints;
  }

  const { regularClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
  const closeValue =
    regularPoints.find((p) => p.time === regularClose)?.value ??
    regularPoints.filter((p) => p.time <= regularClose).at(-1)?.value;
  if (closeValue == null || !Number.isFinite(closeValue)) {
    return regularPoints;
  }

  const postSource = collectStock1DLiveSessionPostMarketSourcePoints(points, sessionYmd, timeZone, now);
  let extendedResampled = resampleStock1DLiveSessionExtendedSegment(
    postSource,
    sessionYmd,
    timeZone,
    closeValue,
    now,
  );

  const ethSpot =
    extendedSpotUsd != null && Number.isFinite(extendedSpotUsd) && extendedSpotUsd > 0
      ? extendedSpotUsd
      : null;
  const ethTime =
    extendedSpotTimeUnix != null && Number.isFinite(extendedSpotTimeUnix) && extendedSpotTimeUnix > 0
      ? extendedSpotTimeUnix
      : null;

  if (!extendedResampled.length && ethSpot != null) {
    const tailUnix = session === "post" ? Math.floor(now.getTime() / 1000) : ethTime;
    extendedResampled = buildMinimalExtendedSegmentFromSpot(
      sessionYmd,
      timeZone,
      closeValue,
      ethSpot,
      now,
      tailUnix ?? undefined,
    );
  } else if (ethSpot != null) {
    if (session === "post") {
      extendedResampled = appendLiveSessionExtendedTail(
        extendedResampled,
        ethSpot,
        sessionYmd,
        timeZone,
        now,
      );
    } else if (ethTime != null && ethTime > regularClose) {
      extendedResampled = appendExtendedTailAtTime(
        extendedResampled,
        ethSpot,
        sessionYmd,
        timeZone,
        ethTime,
      );
    }
  }

  const extendedOnly = extendedResampled.filter((p) => p.time > regularClose);
  if (!extendedOnly.length) {
    return regularPoints;
  }

  const regularTrimmed = regularPoints.filter((p) => p.time <= regularClose);
  return [...regularTrimmed, ...extendedOnly];
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

/** Invisible helper series — full 1-min grid through 16:00 (or 20:00 when extended) for the time scale. */
export function liveSessionSpanWhitespaceData(
  sessionYmd: string,
  timeZone: string,
  extended = false,
): Stock1DLiveSessionLinePoint[] {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = extended
    ? usSessionWallClockUnix(sessionYmd, STOCK_1D_EXTENDED_CLOSE_HOUR, 0, timeZone)
    : usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
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
  return Math.max(0, Math.min(plotW, fraction * plotW));
}

export function stock1DLiveSessionPlotLeftPx(
  chart: IChartApi,
  unix: number,
  sessionYmd: string,
  timeZone: string,
  extended = false,
): number | null {
  if (extended) {
    const { open, extendedClose } = stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone);
    return liveSessionTimeToPlotLeftPx(chart, unix, open, extendedClose);
  }
  const { open, close } = stock1DLiveSessionWallClockBounds(sessionYmd, timeZone);
  return liveSessionTimeToPlotLeftPx(chart, unix, open, close);
}

export function applyStock1DLiveSessionTimeScale(
  chart: IChartApi,
  sessionYmd: string,
  timeZone: string,
  _logicalPointCount: number,
  onApplied?: () => void,
  extended = false,
): void {
  const { open: from, close: regularClose } = stock1DLiveSessionWallClockBounds(sessionYmd, timeZone);
  const to = extended
    ? stock1DLiveSessionExtendedWallClockBounds(sessionYmd, timeZone).extendedClose
    : regularClose;

  const apply = (attempt = 0) => {
    const ts = chart.timeScale();
    const plotW = ts.width();
    if (plotW < 12 && attempt < LIVE_SESSION_RANGE_RETRIES) {
      requestAnimationFrame(() => apply(attempt + 1));
      return;
    }

    const spanBarCount =
      Math.floor((to - from) / STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC) + 1;
    const barSpacing =
      spanBarCount > 1 && plotW > 0 ? plotW / (spanBarCount - 1) : Math.max(0.001, plotW);

    ts.applyOptions({
      fixLeftEdge: true,
      fixRightEdge: false,
      rightOffset: 0,
      lockVisibleTimeRangeOnResize: true,
      shiftVisibleRangeOnNewBar: false,
      allowShiftVisibleRangeOnWhitespaceReplacement: false,
      barSpacing: Math.max(0.001, barSpacing),
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
      const extended = chartPointsIncludeExtendedHoursSegment(ctx.points, ymd, ctx.timeZone);
      applyStock1DLiveSessionTimeScale(
        chart,
        ymd,
        ctx.timeZone,
        logicalPointCount,
        onLiveSessionApplied,
        extended,
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
