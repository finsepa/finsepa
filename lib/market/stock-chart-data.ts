import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_STOCK_1D_LIVE_SPOT, REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

import { resampleStock1DLiveSession } from "@/lib/chart/stock-1d-live-session-chart";
import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import {
  isEodhdUsQuoteDelayedAcceptableForDisplay,
  isEodhdUsQuoteDelayedFresh,
  isEodhdUsRealtimeAcceptableForDisplay,
  isEodhdUsRealtimeFresh,
  isEodhdUsRealtimeFromTodaySession,
  isEodhdUsRealtimeOhlcvUsableDuringRegularSession,
} from "@/lib/market/eodhd-live-quote-freshness";
import { fetchEodhdUsQuoteDelayed } from "@/lib/market/eodhd-us-quote-delayed";
import {
  fetchStockSessionMinuteBarsFromDb,
  getStockSessionMinuteBars,
  mergeStockChartPointsByTime,
  recordStockSessionMinuteBar,
} from "@/lib/market/stock-session-minute-bars";
import { touchStockSessionMinuteBarWatch, fetchLatestStockSessionMinuteBarFromDb } from "@/lib/market/stock-session-minute-bar-store";
import {
  liveMinuteChartNeedsOhlcShapeFallback,
  sessionMinuteBarsHavePriceVariation,
  sessionMinuteBarsNeedsGapFill,
  sessionMinuteBarsTrailingGapSec,
} from "@/lib/market/stock-ws-priority-universe";
import { isStock1DLiveMinuteChartTicker, usesStock1DLiveWsMinutePipeline, usesStock1DLiveWsPostMarketChart } from "@/lib/market/stock-1d-live-minute-chart-tickers";
import { loadStock1DLiveWsMinuteChartPoints } from "@/lib/market/stock-1d-ws-minute-chart";
import {
  getUsEquityMarketSession,
  lastCompletedUsRegularSessionYmd,
  previousUsTradingSessionYmd,
  usEquityTodayRegularSessionComplete,
} from "@/lib/market/us-equity-market-session";
import { getCachedSharesOutstanding } from "@/lib/market/stock-shares-outstanding";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import {
  STOCK_CHART_ALL_LOOKBACK_YEARS,
  type StockChartPoint,
  type StockChartRange,
  type StockChartSeries,
} from "@/lib/market/stock-chart-types";

function clampFinite(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

/**
 * Rebase price points to a **100 = start-of-range** total-return index (same timestamps).
 * Chart / header interpret as percent gain via `(value - 100)`.
 */
export function pricePointsToReturnIndexPoints(points: readonly StockChartPoint[]): StockChartPoint[] {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];
  const p0 = sorted[0]!.value;
  if (!Number.isFinite(p0) || Math.abs(p0) < 1e-12) {
    return sorted.map((p) => ({ time: p.time, value: 100, timeZone: p.timeZone }));
  }
  return sorted.map((p) => ({
    time: p.time,
    value: 100 * (p.value / p0),
    ...(p.sessionDate ? { sessionDate: p.sessionDate } : {}),
    ...(p.timeZone ? { timeZone: p.timeZone } : {}),
  }));
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmdToUnixSeconds(ymd: string): number | null {
  const t = Date.parse(`${ymd}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 1000);
}

function dedupeAndSort(points: StockChartPoint[]): StockChartPoint[] {
  const byTime = new Map<number, StockChartPoint>();
  for (const p of points) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue;
    // last write wins; keep optional fields (sessionDate) for benchmark alignment
    byTime.set(p.time, p);
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

/** ~10m spacing for 5D: thin 5m/1m intraday without going below `minGapSec` between kept bars; last bar always matches latest close. */
export function minGapDownsampleChartPoints(points: StockChartPoint[], minGapSec: number): StockChartPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value)).sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];
  const out: StockChartPoint[] = [];
  let lastKeptT = -Infinity;
  for (const p of sorted) {
    if (p.time - lastKeptT >= minGapSec) {
      out.push(p);
      lastKeptT = p.time;
    }
  }
  const last = sorted[sorted.length - 1]!;
  const tail = out[out.length - 1];
  if (!tail || tail.time !== last.time) {
    if (out.length && last.time - out[out.length - 1]!.time < minGapSec) {
      out[out.length - 1] = last;
    } else {
      out.push(last);
    }
  }
  return dedupeAndSort(out);
}

/**
 * Collapse intraday to **two points per grouping day** (first and last bar in that day).
 * Stocks: pass a key that maps to the US session calendar date; crypto: UTC `yyyy-MM-dd`.
 */
/** Monday `YYYY-MM-DD` session week key (America/New_York). */
export function usSessionWeekKeyFromUnixSeconds(sec: number): string {
  const ymd = usSessionYmdFromUnixSeconds(sec);
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(new Date(anchorMs));
  const dow =
    wd.startsWith("Mon") ? 1
    : wd.startsWith("Tue") ? 2
    : wd.startsWith("Wed") ? 3
    : wd.startsWith("Thu") ? 4
    : wd.startsWith("Fri") ? 5
    : wd.startsWith("Sat") ? 6
    : 0;
  const mondayMs = anchorMs - ((dow + 6) % 7) * 86400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(mondayMs));
}

/** `YYYY-MM` in America/New_York for monthly bucketing. */
export function usSessionMonthKeyFromUnixSeconds(sec: number): string {
  return usSessionYmdFromUnixSeconds(sec).slice(0, 7);
}

/** Last bar in each calendar month bucket (ascending). */
export function oneSamplePerMonthByKey(
  points: StockChartPoint[],
  monthKey: (p: StockChartPoint) => string,
): StockChartPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value)).sort((a, b) => a.time - b.time);
  if (!sorted.length) return [];
  const byMonth = new Map<string, StockChartPoint[]>();
  for (const p of sorted) {
    const k = monthKey(p).trim();
    if (!k) continue;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(p);
  }
  const out: StockChartPoint[] = [];
  for (const k of [...byMonth.keys()].sort()) {
    const monthPts = byMonth.get(k)!;
    if (monthPts.length) out.push(monthPts[monthPts.length - 1]!);
  }
  return dedupeAndSort(out);
}

/** Last bar in each week bucket (ascending). */
export function oneSamplePerWeekByKey(
  points: StockChartPoint[],
  weekKey: (p: StockChartPoint) => string,
): StockChartPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value)).sort((a, b) => a.time - b.time);
  if (!sorted.length) return [];
  const byWeek = new Map<string, StockChartPoint[]>();
  for (const p of sorted) {
    const k = weekKey(p).trim();
    if (!k) continue;
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(p);
  }
  const out: StockChartPoint[] = [];
  for (const k of [...byWeek.keys()].sort()) {
    const weekPts = byWeek.get(k)!;
    if (weekPts.length) out.push(weekPts[weekPts.length - 1]!);
  }
  return dedupeAndSort(out);
}

export function twoSamplesPerDayByKey(
  points: StockChartPoint[],
  dayKey: (p: StockChartPoint) => string,
): StockChartPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value)).sort((a, b) => a.time - b.time);
  if (!sorted.length) return [];
  const byDay = new Map<string, StockChartPoint[]>();
  for (const p of sorted) {
    const k = dayKey(p).trim();
    if (!k) continue;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(p);
  }
  const keys = [...byDay.keys()].sort();
  const out: StockChartPoint[] = [];
  for (const k of keys) {
    const dayPts = byDay.get(k)!.sort((a, b) => a.time - b.time);
    if (!dayPts.length) continue;
    if (dayPts.length === 1) {
      out.push(dayPts[0]!);
      continue;
    }
    const first = dayPts[0]!;
    const lastPt = dayPts[dayPts.length - 1]!;
    out.push(first);
    if (lastPt.time !== first.time) out.push(lastPt);
  }
  return dedupeAndSort(out);
}

export type IntradayTwoPerDaySample = { time: number; sessionDate: string };

/** First + last intraday bar per US session day (same rule as YTD stock charts). */
export function intradayBarsToTwoPerDaySamples(bars: EodhdIntradayBar[]): IntradayTwoPerDaySample[] {
  const pts = barsToChartPoints(bars);
  if (pts.length < 4) return [];
  const dayKey = (p: StockChartPoint) =>
    (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string;
  return twoSamplesPerDayByKey(pts, dayKey).map((p) => ({
    time: p.time,
    sessionDate: (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string,
  }));
}

/** Keep only bars on the UTC calendar day of the latest bar (nearest trading session when window spans multiple days). */
function trimIntradayToLatestUtcDay<T extends { timestamp: number }>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const lastTs = bars[bars.length - 1]!.timestamp;
  const d = new Date(lastTs * 1000);
  const startSec = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
  return bars.filter((b) => b.timestamp >= startSec);
}

/** Keep only bars on the US equity session day of the latest bar. */
function trimIntradayToLatestUsSessionDay<T extends { timestamp: number }>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const lastYmd = usSessionYmdFromUnixSeconds(bars[bars.length - 1]!.timestamp);
  return bars.filter((b) => usSessionYmdFromUnixSeconds(b.timestamp) === lastYmd);
}

/** Last US session day including post-market bars (9:30–20:00 ET) when extended hours apply. */
function trimIntradayToLastUsSessionDayWithExtended<T extends { timestamp: number }>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const inWindow = bars.filter((b) => {
    const ymd = usSessionYmdFromUnixSeconds(b.timestamp);
    const open = usSessionWallClockUnix(ymd, 9, 30, STOCK_DISPLAY_TZ);
    const extendedClose = usSessionWallClockUnix(ymd, 20, 0, STOCK_DISPLAY_TZ);
    return b.timestamp >= open && b.timestamp <= extendedClose;
  });
  if (!inWindow.length) return trimIntradayToLastUsRegularSessionDay(bars);
  const regular = inWindow.filter((b) => {
    const ymd = usSessionYmdFromUnixSeconds(b.timestamp);
    const close = usSessionWallClockUnix(ymd, 16, 0, STOCK_DISPLAY_TZ);
    return b.timestamp <= close;
  });
  const lastYmd = regular.length
    ? usSessionYmdFromUnixSeconds(regular[regular.length - 1]!.timestamp)
    : usSessionYmdFromUnixSeconds(inWindow[inWindow.length - 1]!.timestamp);
  return inWindow.filter((b) => usSessionYmdFromUnixSeconds(b.timestamp) === lastYmd);
}

/** Last completed US regular session (9:30–16:00 ET) — skips pre/post bars on the latest calendar day. */
function trimIntradayToLastUsRegularSessionDay<T extends { timestamp: number }>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const regular = bars.filter((b) => {
    const ymd = usSessionYmdFromUnixSeconds(b.timestamp);
    const open = usSessionWallClockUnix(ymd, 9, 30, STOCK_DISPLAY_TZ);
    const close = usSessionWallClockUnix(ymd, 16, 0, STOCK_DISPLAY_TZ);
    return b.timestamp >= open && b.timestamp <= close;
  });
  if (!regular.length) return trimIntradayToLatestUsSessionDay(bars);
  const lastYmd = usSessionYmdFromUnixSeconds(regular[regular.length - 1]!.timestamp);
  return regular.filter((b) => usSessionYmdFromUnixSeconds(b.timestamp) === lastYmd);
}

/** US session calendar day for an equity bar (aligns with EODHD daily `date` semantics). */
export function usSessionYmdFromUnixSeconds(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

function barsToChartPoints(bars: EodhdIntradayBar[]): StockChartPoint[] {
  return dedupeAndSort(
    bars
      .map((b) => {
        const value = clampFinite(b.close);
        if (value == null) return null;
        return {
          time: b.timestamp,
          value,
          sessionDate: usSessionYmdFromUnixSeconds(b.timestamp),
        };
      })
      .filter(Boolean) as StockChartPoint[],
  );
}

/** Keep points whose US `sessionDate` falls in the last `n` distinct session days (ascending order). */
export function trimPointsToLastNUsSessionDays(points: StockChartPoint[], n: number): StockChartPoint[] {
  if (points.length === 0 || n < 1) return points;
  const dated = points.map((p) => ({
    p,
    d: (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string,
  }));
  const uniq = [...new Set(dated.map((x) => x.d))].sort();
  if (uniq.length <= n) return points;
  const keep = new Set(uniq.slice(-n));
  return dated.filter((x) => keep.has(x.d)).map((x) => x.p);
}

/** Last `n` daily EOD closes (ascending). */
async function loadDailyLastNCloses(ticker: string, now: Date, n: number, calendarLookbackDays: number): Promise<StockChartPoint[]> {
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - calendarLookbackDays);
  const fromStr = ymdUtc(fromDate);
  const toStr = ymdUtc(now);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const slice = sorted.slice(-n);
  const points = slice
    .map((b) => {
      const t = parseYmdToUnixSeconds(b.date);
      const v = clampFinite(b.close);
      if (t == null || v == null) return null;
      return { time: t, value: v, sessionDate: b.date };
    })
    .filter(Boolean) as StockChartPoint[];
  return dedupeAndSort(points);
}

/** Full series from daily bars — use with {@link sliceStockChartPointsForRange} to match chart range without a second EOD fetch. */
export function stockChartPointsFromDailyBars(bars: EodhdDailyBar[]): StockChartPoint[] {
  const points = bars
    .map((b) => {
      const t = parseYmdToUnixSeconds(b.date);
      const v = clampFinite(b.close);
      if (t == null || v == null) return null;
      return { time: t, value: v, sessionDate: b.date };
    })
    .filter(Boolean) as StockChartPoint[];
  return dedupeAndSort(points);
}

/** Target bar spacing for Overview 5D intraday charts (EODHD 1m → ~4m). */
const SESSION_INTRADAY_CHART_BAR_GAP_SEC = 4 * 60;

/** Closed 1D historical session: thin EODHD 1m to ~2m between points. */
export const STOCK_1D_CLOSED_SESSION_BAR_GAP_SEC = 2 * 60;

function filterToUsRegularSessionPoints(points: StockChartPoint[]): StockChartPoint[] {
  return points.filter((p) => {
    if (!Number.isFinite(p.time)) return false;
    const ymd = usSessionYmdFromUnixSeconds(p.time);
    const open = usSessionWallClockUnix(ymd, 9, 30, STOCK_DISPLAY_TZ);
    const close = usSessionWallClockUnix(ymd, 16, 0, STOCK_DISPLAY_TZ);
    return p.time >= open && p.time <= close;
  });
}

/** Regular session plus post-market (9:30–20:00 ET) for 1D extended-hours sparkline. */
function filterToUsSessionWithPostPoints(points: StockChartPoint[]): StockChartPoint[] {
  return points.filter((p) => {
    if (!Number.isFinite(p.time)) return false;
    const ymd = usSessionYmdFromUnixSeconds(p.time);
    const open = usSessionWallClockUnix(ymd, 9, 30, STOCK_DISPLAY_TZ);
    const extendedClose = usSessionWallClockUnix(ymd, 20, 0, STOCK_DISPLAY_TZ);
    return p.time >= open && p.time <= extendedClose;
  });
}

function filterToUsPostMarketSessionPoints(points: StockChartPoint[]): StockChartPoint[] {
  return points.filter((p) => {
    if (!Number.isFinite(p.time)) return false;
    const ymd = usSessionYmdFromUnixSeconds(p.time);
    const regularClose = usSessionWallClockUnix(ymd, 16, 0, STOCK_DISPLAY_TZ);
    const extendedClose = usSessionWallClockUnix(ymd, 20, 0, STOCK_DISPLAY_TZ);
    return p.time > regularClose && p.time <= extendedClose;
  });
}

/** Drop pre/post bars and today's incomplete session when the regular day has not finished. */
function finalizeMultiDayChartPointsForSession(
  points: StockChartPoint[],
  now: Date = new Date(),
): StockChartPoint[] {
  const regular = filterToUsRegularSessionPoints(points);
  const base = regular.length ? regular : points;
  if (usEquityTodayRegularSessionComplete(now)) return base;
  const todayYmd = usSessionYmdFromUnixSeconds(Math.floor(now.getTime() / 1000));
  return base.filter((p) => {
    const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
    return ymd !== todayYmd;
  });
}

function finalize1DIntradayPoints(points: StockChartPoint[], now: Date = new Date()): StockChartPoint[] {
  if (!points.length) return points;
  const regular = filterToUsRegularSessionPoints(points);
  const thinned = dedupeAndSort(regular.length ? regular : points);
  if (getUsEquityMarketSession(now) === "regular") {
    const nowSec = Math.floor(now.getTime() / 1000);
    const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
    const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
    const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);
    const endSec = Math.min(nowSec, closeSec);
    const todayOnly = thinned.filter((p) => {
      const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
      return ymd === todayYmd;
    });
    const inWindow = thinned.filter((p) => p.time >= openSec && p.time <= endSec);
    const todayBars = todayOnly.length ? todayOnly : inWindow;
    if (!todayBars.length) return [];
    const openValue = todayBars[0]!.value;
    if (!Number.isFinite(openValue)) return todayBars;
    return todayBars;
  }

  const lastSession = trimPointsToLastNUsSessionDays(thinned, 1);
  if (!lastSession.length) return [];
  const sessionYmd =
    lastSession[0]!.sessionDate?.trim() || usSessionYmdFromUnixSeconds(lastSession[0]!.time);
  const regularOnly = filterToUsRegularSessionPoints(lastSession);
  const source = regularOnly.length ? regularOnly : lastSession;
  if (!source.length) return [];
  return minGapDownsampleChartPoints(source, STOCK_1D_CLOSED_SESSION_BAR_GAP_SEC);
}

/**
 * Session OHLC from `/api/real-time` when WS minute bars do not cover the open yet.
 * EODHD intraday REST is empty during the live session; this is the best same-day fill.
 */
function build1DSessionOhlcAnchorPoints(
  rt: Awaited<ReturnType<typeof fetchEodhdUsRealtime>>,
  now: Date,
): StockChartPoint[] {
  const sessionStampOk = isEodhdUsRealtimeFromTodaySession(rt, now);
  const ohlcvUsable = isEodhdUsRealtimeOhlcvUsableDuringRegularSession(rt, now);
  if (!rt || (!sessionStampOk && !ohlcvUsable)) return [];

  const open = rt.open != null ? clampFinite(rt.open) : clampFinite(rt.previousClose ?? NaN);
  const high = rt.high != null ? clampFinite(rt.high) : null;
  const low = rt.low != null ? clampFinite(rt.low) : null;
  const close = rt.close != null ? clampFinite(rt.close) : null;
  if (open == null || open <= 0 || close == null || close <= 0) return [];

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);
  const endSec = Math.min(nowSec, closeSec);
  if (endSec <= openSec) return [];

  const elapsed = endSec - openSec;
  const anchors: StockChartPoint[] = [
    { time: openSec, value: open, sessionDate: todayYmd, timeZone: STOCK_DISPLAY_TZ },
  ];

  const pushAnchor = (time: number, value: number | null) => {
    if (value == null || value <= 0 || time <= openSec || time > endSec) return;
    if (anchors.some((a) => a.time === time)) return;
    anchors.push({ time, value, sessionDate: todayYmd, timeZone: STOCK_DISPLAY_TZ });
  };

  if (high != null && high > 0 && Math.abs(high - open) >= 0.01) {
    pushAnchor(openSec + Math.floor(elapsed * 0.28), high);
  }
  if (low != null && low > 0 && Math.abs(low - open) >= 0.01) {
    pushAnchor(openSec + Math.floor(elapsed * 0.58), low);
  }

  let tailSec = endSec;
  if (
    sessionStampOk &&
    typeof rt.timestamp === "number" &&
    rt.timestamp > openSec &&
    rt.timestamp <= endSec
  ) {
    tailSec = Math.floor(rt.timestamp);
  }
  pushAnchor(tailSec, close);
  if (!anchors.some((a) => a.time === endSec)) {
    anchors.push({ time: endSec, value: close, sessionDate: todayYmd, timeZone: STOCK_DISPLAY_TZ });
  }

  return anchors.sort((a, b) => a.time - b.time);
}

async function build1DSessionOhlcAnchorChart(
  ticker: string,
  now: Date,
): Promise<StockChartPoint[]> {
  const rt = await fetchEodhdUsRealtime(ticker);
  const anchors = build1DSessionOhlcAnchorPoints(rt, now);
  if (anchors.length < 2) return [];
  const sessionYmd = anchors[0]!.sessionDate?.trim() || usSessionYmdFromUnixSeconds(Math.floor(now.getTime() / 1000));
  return resampleStock1DLiveSession(anchors, sessionYmd, STOCK_DISPLAY_TZ, anchors[0]!.value, now);
}

/** Fill missing 9:30→now chart when WS missed the open + mid-session holes. */
async function fillTodaySessionChartGaps(
  ticker: string,
  pollBars: readonly StockChartPoint[],
  todayYmd: string,
  now: Date,
): Promise<StockChartPoint[]> {
  const liveMinuteChart = isStock1DLiveMinuteChartTicker(ticker);
  if (!sessionMinuteBarsNeedsGapFill(pollBars, todayYmd, STOCK_DISPLAY_TZ, now)) {
    return [...pollBars];
  }

  if (!liveMinuteChart) {
    const { points: intraday } = await load1DIntradayForSessionYmdWithMeta(ticker, todayYmd);
    if (intraday.length >= 2) {
      return mergeStockChartPointsByTime([intraday, pollBars]);
    }
  }

  if (liveMinuteChart) {
    const nowSec = Math.floor(now.getTime() / 1000);
    const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
    for (const interval of ["1m", "5m"] as const) {
      const bars = await fetchEodhdIntraday(ticker, openSec, nowSec, interval);
      if (!bars?.length) continue;
      const points = filterToUsRegularSessionPoints(barsToChartPoints(bars)).filter((p) => {
        const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
        return ymd === todayYmd;
      });
      if (points.length >= 2) {
        return mergeStockChartPointsByTime([points, pollBars]);
      }
    }

    // Live EODHD 1m is usually empty intraday — only synthesize OHLC when WS barely has data.
    if (liveMinuteChartNeedsOhlcShapeFallback(pollBars, todayYmd, STOCK_DISPLAY_TZ, now)) {
      const ohlcChart = await build1DSessionOhlcAnchorChart(ticker, now);
      if (ohlcChart.length >= 2) {
        return mergeStockChartPointsByTime([ohlcChart, pollBars]);
      }

      const anchors = await build1DRealtimeSessionAnchorPoints(ticker, now);
      if (anchors.length >= 2) {
        return mergeStockChartPointsByTime([anchors, pollBars]);
      }
    }

    return [...pollBars];
  }

  const ohlcChart = await build1DSessionOhlcAnchorChart(ticker, now);
  if (ohlcChart.length >= 2) {
    return mergeStockChartPointsByTime([ohlcChart, pollBars]);
  }

  return [...pollBars];
}

/** Fill the hole between the last WS/DB bar and now (common after navigating away). */
async function backfillTrailingSessionMinuteGap(
  ticker: string,
  points: readonly StockChartPoint[],
  sessionYmd: string,
  now: Date,
): Promise<StockChartPoint[]> {
  if (getUsEquityMarketSession(now) !== "regular") return [...points];
  if (sessionMinuteBarsTrailingGapSec(points, sessionYmd, STOCK_DISPLAY_TZ, now) <= 2 * 60) {
    return [...points];
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  const endSec = Math.min(nowSec, closeSec);
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const inSession = points
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);
  const fromSec = inSession.length ? inSession[inSession.length - 1]!.time + 60 : openSec;
  if (fromSec >= endSec) return [...points];

  for (const interval of ["1m", "5m"] as const) {
    const bars = await fetchEodhdIntraday(ticker, fromSec, endSec, interval);
    if (!bars?.length) continue;
    const added = filterToUsRegularSessionPoints(barsToChartPoints(bars)).filter((p) => {
      const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
      return ymd === sessionYmd && p.time >= fromSec && p.time <= endSec;
    });
    if (added.length) {
      return mergeStockChartPointsByTime([points, added]);
    }
  }

  return [...points];
}

/**
 * EODHD intraday REST is finalized ~2–3h after the close, so today's 1m bars are often
 * missing during the live session. Build open + live tail anchors from the realtime quote.
 */
async function build1DRealtimeSessionAnchorPoints(
  ticker: string,
  now: Date,
): Promise<StockChartPoint[]> {
  const rt = await fetchEodhdUsRealtime(ticker);
  const sessionStampOk = isEodhdUsRealtimeFromTodaySession(rt, now);
  const ohlcvUsable = isEodhdUsRealtimeOhlcvUsableDuringRegularSession(rt, now);
  if (!rt || (!sessionStampOk && !ohlcvUsable)) return [];

  const open = rt.open != null ? clampFinite(rt.open) : clampFinite(rt.previousClose ?? NaN);
  const close = rt.close != null ? clampFinite(rt.close) : null;
  if (open == null || close == null || open <= 0 || close <= 0) return [];

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);
  const endSec = Math.min(nowSec, closeSec);
  if (endSec <= openSec) return [];

  let tailSec = endSec;
  if (
    sessionStampOk &&
    typeof rt.timestamp === "number" &&
    rt.timestamp > openSec &&
    rt.timestamp <= endSec
  ) {
    tailSec = Math.floor(rt.timestamp);
  }

  const anchors: StockChartPoint[] = [
    { time: openSec, value: open, sessionDate: todayYmd, timeZone: STOCK_DISPLAY_TZ },
  ];

  if (tailSec > openSec) {
    anchors.push({ time: tailSec, value: close, sessionDate: todayYmd, timeZone: STOCK_DISPLAY_TZ });
  }

  return anchors;
}

/** Merge EODHD `/api/real-time` live OHLCV close as the chart tail during regular session. */
async function append1DRealtimeTail(
  ticker: string,
  points: readonly StockChartPoint[],
  now: Date,
): Promise<StockChartPoint[]> {
  const rt = await fetchEodhdUsRealtime(ticker);
  const sessionStampOk = isEodhdUsRealtimeFromTodaySession(rt, now);
  const ohlcvUsable = isEodhdUsRealtimeOhlcvUsableDuringRegularSession(rt, now);
  if (!rt || (!sessionStampOk && !ohlcvUsable)) return [...points];

  const close = rt.close != null ? clampFinite(rt.close) : null;
  if (close == null || close <= 0) return [...points];

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);
  const endSec = Math.min(nowSec, closeSec);

  let tailSec = endSec;
  if (
    isEodhdUsRealtimeFresh(rt, now) &&
    typeof rt.timestamp === "number" &&
    rt.timestamp >= openSec &&
    rt.timestamp <= endSec
  ) {
    tailSec = Math.floor(rt.timestamp);
  }

  const tail: StockChartPoint = {
    time: tailSec,
    value: close,
    sessionDate: todayYmd,
    timeZone: STOCK_DISPLAY_TZ,
  };
  if (isEodhdUsRealtimeFresh(rt, now)) {
    recordStockSessionMinuteBar(ticker, close, now);
  }
  return mergeStockChartPointsByTime([points, [tail]]);
}

async function load1DIntradayForSessionYmdWithMeta(
  ticker: string,
  sessionYmd: string,
): Promise<{ points: StockChartPoint[]; interval: "1m" | "5m" | "1h" | null }> {
  for (const interval of ["1m", "5m", "1h"] as const) {
    const bars = await getHistoricalSessionIntradayBars(ticker, sessionYmd, interval);
    const points = historicalSessionIntradayToChartPoints(bars, sessionYmd);
    if (points.length >= 2) return { points, interval };
  }
  return { points: [], interval: null };
}

/** EODHD 1m/5m for one completed session — cached ~12h so repeat views do not burn budget. */
async function fetchHistoricalSessionIntradayUncached(
  ticker: string,
  sessionYmd: string,
  interval: "1m" | "5m" | "1h",
): Promise<EodhdIntradayBar[] | null> {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  const nowSec = Math.floor(Date.now() / 1000);

  const direct = await fetchEodhdIntraday(ticker, openSec, closeSec, interval);
  const directSession = filterIntradayBarsToSessionYmd(direct, sessionYmd);
  if (directSession?.length) return directSession;

  const wide = await fetchEodhdIntraday(
    ticker,
    openSec - 7 * 86400,
    Math.min(closeSec + 3600, nowSec),
    interval,
  );
  return filterIntradayBarsToSessionYmd(wide, sessionYmd);
}

function filterIntradayBarsToSessionYmd(
  bars: EodhdIntradayBar[] | null | undefined,
  sessionYmd: string,
): EodhdIntradayBar[] | null {
  if (!bars?.length) return null;
  const filtered = bars.filter((b) => usSessionYmdFromUnixSeconds(b.timestamp) === sessionYmd);
  return filtered.length ? filtered : null;
}

const getHistoricalSessionIntradayBars = unstable_cache(
  async (ticker: string, sessionYmd: string, interval: "1m" | "5m" | "1h") =>
    fetchHistoricalSessionIntradayUncached(ticker, sessionYmd, interval),
  ["eodhd-historical-session-intraday-v4"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

function historicalSessionIntradayToChartPoints(
  bars: EodhdIntradayBar[] | null | undefined,
  sessionYmd: string,
): StockChartPoint[] {
  if (!bars?.length) return [];
  const sessionBars = filterIntradayBarsToSessionYmd(bars, sessionYmd);
  if (!sessionBars?.length) return [];
  const points = barsToChartPoints(sessionBars).map((p) => ({
    ...p,
    sessionDate: sessionYmd,
    timeZone: STOCK_DISPLAY_TZ,
  }));
  const regular = filterToUsRegularSessionPoints(points);
  if (regular.length < 2) return [];
  return dedupeAndSort(regular);
}

/** True when 1D uses the live WS minute pipeline (regular) or frozen post-market chart. */
export function isStock1DLiveSessionMinuteChart(
  ticker: string,
  now: Date = new Date(),
): boolean {
  return usesStock1DLiveWsMinutePipeline(ticker, now) || usesStock1DLiveWsPostMarketChart(ticker, now);
}

/** AAPL/NVDA closed-market 1D diagnostics — session/source/interval/coverage. */
const CLOSED_1D_DEBUG_TICKERS = new Set(["AAPL", "NVDA"]);

function logClosed1DChartDebug(args: {
  ticker: string;
  now: Date;
  sessionYmd: string;
  source: "ws-regular-frozen" | "eodhd-prior-session";
  interval: "1m" | "5m" | "1h" | null;
  points: readonly StockChartPoint[];
}): void {
  const sym = args.ticker.trim().toUpperCase();
  if (!CLOSED_1D_DEBUG_TICKERS.has(sym)) return;
  const first = args.points[0]?.time ?? null;
  const last = args.points.at(-1)?.time ?? null;
  const iso = (t: number | null) =>
    t == null ? null : new Date(t * 1000).toISOString();
  console.info("[closed-1d]", sym, {
    session: getUsEquityMarketSession(args.now),
    sessionYmd: args.sessionYmd,
    source: args.source,
    interval: args.interval,
    firstPointTime: iso(first),
    lastPointTime: iso(last),
    pointCount: args.points.length,
  });
}

/** Last completed US session — EODHD intraday at native interval (1m/5m/1h). */
async function loadLatestTradingDay1DChartPoints(
  ticker: string,
  now: Date,
  debug = false,
): Promise<StockChartPoint[]> {
  let sessionYmd = lastCompletedUsRegularSessionYmd(now, STOCK_DISPLAY_TZ);
  for (let attempt = 0; attempt < 8; attempt++) {
    const { points, interval } = await load1DIntradayForSessionYmdWithMeta(ticker, sessionYmd);
    if (points.length >= 2) {
      if (debug) {
        logClosed1DChartDebug({
          ticker,
          now,
          sessionYmd,
          source: "eodhd-prior-session",
          interval,
          points,
        });
      }
      return points;
    }
    sessionYmd = previousUsTradingSessionYmd(sessionYmd, STOCK_DISPLAY_TZ);
  }
  return [];
}

/**
 * 1D live session: WS minute store (allowlist via {@link usesStock1DLiveWsMinutePipeline}).
 * All other tickers: last completed session via EODHD intraday (chart only).
 */
async function load1DChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  if (!isStock1DLiveMinuteChartTicker(ticker)) {
    return loadLatestTradingDay1DChartPoints(ticker, now);
  }

  const session = getUsEquityMarketSession(now);
  const postMarketChart = usesStock1DLiveWsPostMarketChart(ticker, now);

  if (session === "regular" || postMarketChart) {
    const points = await loadStock1DLiveWsMinuteChartPoints(ticker, now);
    if (postMarketChart) {
      logClosed1DChartDebug({
        ticker,
        now,
        sessionYmd: usSessionYmdFromUnixSeconds(nowSec),
        source: "ws-regular-frozen",
        interval: "1m",
        points,
      });
    }
    return points;
  }

  // Closed and pre-market (allowlist): show the last completed regular session at native 1m,
  // pinned to the actual latest session — identical to non-allowlist tickers.
  return loadLatestTradingDay1DChartPoints(ticker, now, true);
}

/**
 * When intraday is unavailable, build a 1m session chart from daily EOD bars.
 * Uses prior close as the 9:30 open proxy when the bar has no open field.
 */
export function synthesize1DSessionChartFromDailyBars(
  bars: EodhdDailyBar[],
  now: Date = new Date(),
): StockChartPoint[] {
  if (!bars.length) return [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  let bar = sorted[sorted.length - 1]!;
  const todayYmd = usSessionYmdFromUnixSeconds(Math.floor(now.getTime() / 1000));
  if (bar.date === todayYmd && !usEquityTodayRegularSessionComplete(now) && sorted.length > 1) {
    bar = sorted[sorted.length - 2]!;
  }

  const sessionYmd = bar.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionYmd)) return [];

  const close = clampFinite(bar.close);
  if (close == null || close <= 0) return [];

  const barIdx = sorted.findIndex((b) => b.date === sessionYmd);
  const prevBar = barIdx > 0 ? sorted[barIdx - 1] : null;
  const prevClose = prevBar ? clampFinite(prevBar.close) : null;
  const openValue = prevClose != null && prevClose > 0 ? prevClose : close;

  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  const anchors: StockChartPoint[] = [
    { time: openSec, value: openValue, sessionDate: sessionYmd, timeZone: STOCK_DISPLAY_TZ },
    { time: closeSec, value: close, sessionDate: sessionYmd, timeZone: STOCK_DISPLAY_TZ },
  ];

  return resampleStock1DLiveSession(anchors, sessionYmd, STOCK_DISPLAY_TZ, openValue, now);
}

const ONE_MONTH_BAR_GAP_SEC = 30 * 60;

/**
 * 5D: same ~4m intraday spacing as 1D over the last 5 US sessions; hourly only if finer data missing.
 */
async function load5DChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const tries: { lookbackSec: number; interval: "5m" | "1m" | "1h" }[] = [
    { lookbackSec: 14 * 86400, interval: "1m" },
    { lookbackSec: 10 * 86400, interval: "1m" },
    { lookbackSec: 14 * 86400, interval: "5m" },
    { lookbackSec: 10 * 86400, interval: "5m" },
    { lookbackSec: 10 * 86400, interval: "1h" },
    { lookbackSec: 14 * 86400, interval: "1h" },
  ];

  for (const t of tries) {
    const from = nowSec - t.lookbackSec;
    const bars = await fetchEodhdIntraday(ticker, from, nowSec, t.interval);
    if (process.env.NODE_ENV === "development") {
      console.info("[stock chart] 5D intraday attempt", {
        ticker,
        endpoint: "GET /api/intraday/{symbol}",
        fromUnix: from,
        toUnix: nowSec,
        interval: t.interval,
        barCount: bars?.length ?? 0,
      });
    }
    if (!bars?.length) continue;
    let pts = barsToChartPoints(bars);
    pts = finalizeMultiDayChartPointsForSession(pts, now);
    pts = trimPointsToLastNUsSessionDays(pts, 5);
    if (!pts.length) continue;
    if (t.interval === "1h") {
      return pts;
    }
    pts = minGapDownsampleChartPoints(pts, SESSION_INTRADAY_CHART_BAR_GAP_SEC);
    if (pts.length) return pts;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 5D: intraday empty; fallback last 5 daily closes", { ticker });
  }
  return loadDailyLastNCloses(ticker, now, 5, 21);
}

/**
 * 1M: 5m or 1m intraday (wider lookback than the visible month), then ~one point per 30 minutes;
 * hourly only if finer intervals fail. Otherwise daily EOD.
 */
async function load1MChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const strategies: { lookbackSec: number; interval: "5m" | "1m" | "1h" }[] = [
    { lookbackSec: 34 * 86400, interval: "1m" },
    { lookbackSec: 42 * 86400, interval: "1m" },
    { lookbackSec: 55 * 86400, interval: "1m" },
    { lookbackSec: 42 * 86400, interval: "5m" },
    { lookbackSec: 55 * 86400, interval: "5m" },
    { lookbackSec: 42 * 86400, interval: "1h" },
    { lookbackSec: 55 * 86400, interval: "1h" },
  ];

  for (const s of strategies) {
    const bars = await fetchEodhdIntraday(ticker, nowSec - s.lookbackSec, nowSec, s.interval);
    if (process.env.NODE_ENV === "development") {
      console.info("[stock chart] 1M intraday attempt", {
        ticker,
        interval: s.interval,
        lookbackDays: Math.round(s.lookbackSec / 86400),
        barCount: bars?.length ?? 0,
      });
    }
    if (!bars?.length) continue;
    let pts = barsToChartPoints(bars);
    if (pts.length < 36) continue;
    pts = minGapDownsampleChartPoints(pts, ONE_MONTH_BAR_GAP_SEC);
    if (pts.length < 18) continue;
    return pts;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 1M: intraday sparse/empty; fallback daily EOD", { ticker });
  }

  const toStr = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 45);
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  const points = daily
    .map((b) => {
      const t = parseYmdToUnixSeconds(b.date);
      const v = clampFinite(b.close);
      if (t == null || v == null) return null;
      return { time: t, value: v, sessionDate: b.date };
    })
    .filter(Boolean) as StockChartPoint[];
  return dedupeAndSort(points);
}

/** 6M / YTD: morning open (9:30 AM ET) and afternoon slot (1:30 PM ET) per session day. */
function usSessionTwoSlotDayUnixForYmd(ymd: string): { open: number; afternoon: number } {
  return {
    open: usSessionWallClockUnix(ymd, 9, 30),
    afternoon: usSessionWallClockUnix(ymd, 13, 30),
  };
}

/** Two chart points per EOD day (open + close anchors) when intraday is unavailable. */
function dailyBarsToTwoPointsPerSessionDay(bars: EodhdDailyBar[]): StockChartPoint[] {
  const out: StockChartPoint[] = [];
  for (const b of bars) {
    const v = clampFinite(b.close);
    if (v == null || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) continue;
    const { open, afternoon } = usSessionTwoSlotDayUnixForYmd(b.date);
    out.push({ time: open, value: v, sessionDate: b.date });
    if (afternoon > open) out.push({ time: afternoon, value: v, sessionDate: b.date });
  }
  return dedupeAndSort(out);
}

async function load6MDailyFallback(ticker: string, now: Date): Promise<StockChartPoint[]> {
  const toStr = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 210);
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  return dailyBarsToTwoPointsPerSessionDay(daily);
}

/**
 * 6M: intraday (1h then 5m) over ~7–8 months, then **two samples per US session day** (session open / last bar of day).
 * Falls back to daily EOD.
 */
async function load6MChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const dayKey = (p: StockChartPoint) =>
    (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string;

  const sixMonthStartSec = nowSec - 183 * 86400;
  // One 1h intraday fetch is enough for two-samples-per-day; avoid heavy 5m/1m windows.
  const bars = await fetchEodhdIntraday(ticker, sixMonthStartSec - 14 * 86400, nowSec, "1h");
  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 6M intraday attempt", {
      ticker,
      interval: "1h",
      barCount: bars?.length ?? 0,
    });
  }
  if (bars?.length) {
    let pts = barsToChartPoints(bars);
    if (pts.length >= 40) {
      pts = twoSamplesPerDayByKey(pts, dayKey);
      pts = pts.filter((p) => p.time >= sixMonthStartSec);
      if (pts.length >= 40) return pts;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 6M: intraday sparse; fallback daily EOD", { ticker });
  }
  return load6MDailyFallback(ticker, now);
}

async function loadYTDDailyFallback(ticker: string, now: Date): Promise<StockChartPoint[]> {
  const toStr = ymdUtc(now);
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  return dailyBarsToTwoPointsPerSessionDay(daily);
}

/**
 * YTD: same as 6M — 1h intraday, two samples per US session day (9:30 AM / 1:30 PM slots);
 * falls back to daily EOD with two points per day.
 */
async function loadYTDChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const ytdStartSec = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
  const dayKey = (p: StockChartPoint) =>
    (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string;

  const bars = await fetchEodhdIntraday(ticker, ytdStartSec - 14 * 86400, nowSec, "1h");
  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] YTD intraday attempt", {
      ticker,
      interval: "1h",
      barCount: bars?.length ?? 0,
    });
  }
  if (bars?.length) {
    let pts = barsToChartPoints(bars);
    if (pts.length >= 4) {
      pts = twoSamplesPerDayByKey(pts, dayKey);
      pts = pts.filter((p) => p.time >= ytdStartSec);
      if (pts.length >= 4) return pts;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] YTD: intraday sparse; fallback daily EOD", { ticker });
  }
  return loadYTDDailyFallback(ticker, now);
}

async function load1YDailyFallback(ticker: string, now: Date): Promise<StockChartPoint[]> {
  const toStr = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  return dailyBarsToTwoPointsPerSessionDay(daily);
}

/**
 * 1Y: same two-slot day model as 6M / YTD (1h intraday → two samples per session day).
 */
async function load1YChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const oneYearStartSec = nowSec - 365 * 86400;
  const dayKey = (p: StockChartPoint) =>
    (p.sessionDate?.trim() ? p.sessionDate : usSessionYmdFromUnixSeconds(p.time)) as string;

  const bars = await fetchEodhdIntraday(ticker, oneYearStartSec - 14 * 86400, nowSec, "1h");
  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 1Y intraday attempt", {
      ticker,
      interval: "1h",
      barCount: bars?.length ?? 0,
    });
  }
  if (bars?.length) {
    let pts = barsToChartPoints(bars);
    if (pts.length >= 40) {
      pts = twoSamplesPerDayByKey(pts, dayKey);
      pts = pts.filter((p) => p.time >= oneYearStartSec);
      if (pts.length >= 40) return pts;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 1Y: intraday sparse; fallback daily EOD", { ticker });
  }
  return load1YDailyFallback(ticker, now);
}

/**
 * 5Y: daily EOD downsampled to **one point per US session week** (last close of the week).
 */
async function load5YChartPoints(ticker: string, now: Date): Promise<StockChartPoint[]> {
  const toStr = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 5);
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  const pts = stockChartPointsFromDailyBars(daily);
  return oneSamplePerWeekByKey(pts, (p) => usSessionWeekKeyFromUnixSeconds(p.time));
}

/**
 * ALL: full EOD history downsampled to **one point per US session month** (last close of the month).
 */
async function loadALLChartPoints(ticker: string, now: Date): Promise<StockChartPoint[]> {
  const toStr = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  const fromStr = ymdUtc(fromDate);
  const daily = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!daily?.length) return [];
  const pts = stockChartPointsFromDailyBars(daily);
  return oneSamplePerMonthByKey(pts, (p) => usSessionMonthKeyFromUnixSeconds(p.time));
}

async function loadStockPriceChartPointsUncached(ticker: string, range: StockChartRange): Promise<StockChartPoint[]> {
  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  let pts: StockChartPoint[];
  if (range === "1D") {
    return load1DChartPoints(ticker, now, nowSec);
  }
  if (range === "5D") {
    pts = await load5DChartPoints(ticker, now, nowSec);
  } else if (range === "1M") {
    pts = await load1MChartPoints(ticker, now, nowSec);
  } else if (range === "6M") {
    pts = await load6MChartPoints(ticker, now, nowSec);
  } else if (range === "YTD") {
    pts = await loadYTDChartPoints(ticker, now, nowSec);
  } else if (range === "1Y") {
    pts = await load1YChartPoints(ticker, now, nowSec);
  } else if (range === "5Y") {
    pts = await load5YChartPoints(ticker, now);
  } else if (range === "ALL") {
    pts = await loadALLChartPoints(ticker, now);
  } else {
    return [];
  }

  if (getUsEquityMarketSession(now) !== "regular") {
    return finalizeMultiDayChartPointsForSession(pts, now);
  }
  return pts;
}

async function loadStockChartPointsUncached(
  ticker: string,
  range: StockChartRange,
  series: StockChartSeries,
): Promise<StockChartPoint[]> {
  const pricePoints = await loadStockPriceChartPointsUncached(ticker, range);
  if (series === "return") return pricePointsToReturnIndexPoints(pricePoints);
  if (series !== "marketCap") return pricePoints;
  const shares = await getCachedSharesOutstanding(ticker);
  if (shares == null || shares <= 0) return [];
  return pricePoints.map((p) => ({ ...p, value: p.value * shares }));
}

export const getStockChartPoints = unstable_cache(
  async (ticker: string, range: StockChartRange, series: StockChartSeries) =>
    loadStockChartPointsUncached(ticker, range, series),
  ["stock-chart-points-v34-ws-minute-only"],
  { revalidate: REVALIDATE_HOT },
);

/** Immutable prior-session 1D charts — session date only changes after the close. */
const getStockChartPoints1DPriorSession = unstable_cache(
  async (ticker: string, series: StockChartSeries) =>
    loadStockChartPointsUncached(ticker, "1D", series),
  ["stock-chart-1d-prior-session-v8-static-day"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

function requestStockMinuteBarWatch(ticker: string): void {
  void touchStockSessionMinuteBarWatch(ticker).catch(() => {});
}

/** Stock page + chart API entry — fresher 1D cache during regular session. */
export async function getStockChartPointsForApi(
  ticker: string,
  range: StockChartRange,
  series: StockChartSeries,
): Promise<StockChartPoint[]> {
  const now = new Date();
  if (range === "1D") {
    if (usesStock1DLiveWsMinutePipeline(ticker, now)) {
      requestStockMinuteBarWatch(ticker);
      logApi1DBranchDebug(ticker, now, "ws-regular-uncached");
      return loadStockChartPointsUncached(ticker, "1D", series);
    }
    if (usesStock1DLiveWsPostMarketChart(ticker, now)) {
      logApi1DBranchDebug(ticker, now, "ws-postmarket-uncached");
      return loadStockChartPointsUncached(ticker, "1D", series);
    }
    // Non-live 1D (closed / pre-market): allowlist and non-allowlist share the immutable
    // prior-session cache so all four reference tickers select the same last completed session.
    logApi1DBranchDebug(ticker, now, "prior-session-cache");
    return getStockChartPoints1DPriorSession(ticker, series);
  }
  return getStockChartPoints(ticker, range, series);
}

/** AAPL/NVDA API-entry diagnostics — session, allowlist flag, selected cache branch. */
function logApi1DBranchDebug(
  ticker: string,
  now: Date,
  branch: "ws-regular-uncached" | "ws-postmarket-uncached" | "prior-session-cache",
): void {
  const sym = ticker.trim().toUpperCase();
  if (!CLOSED_1D_DEBUG_TICKERS.has(sym)) return;
  console.info("[closed-1d api]", sym, {
    session: getUsEquityMarketSession(now),
    isLiveMinuteTicker: isStock1DLiveMinuteChartTicker(ticker),
    branch,
  });
}

/** Superinvestor holding panel only — same series as {@link getStockChartPoints}, refreshed ~once per day. */
export const getSuperinvestorHoldingStockChartPoints = unstable_cache(
  async (ticker: string, range: StockChartRange, series: StockChartSeries) =>
    loadStockChartPointsUncached(ticker, range, series),
  ["stock-chart-superinvestor-holding-daily-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

export type StockSpotQuote = {
  price: number | null;
  /** Prior regular-session close — from realtime `previousClose` during live hours. */
  previousClose: number | null;
  /** Trade / quote UNIX seconds when known (EODHD realtime timestamp or minute bar). */
  quotedAtSec?: number | null;
};

function previousCloseFromRealtimePayload(
  rt: Awaited<ReturnType<typeof fetchEodhdUsRealtime>>,
): number | null {
  if (!rt) return null;
  const prev = rt.previousClose != null ? clampFinite(rt.previousClose) : null;
  if (prev != null && prev > 0) return prev;
  const close = rt.close != null ? clampFinite(rt.close) : null;
  const change = rt.change != null ? clampFinite(rt.change) : null;
  if (close != null && change != null && close > 0) {
    const derived = close - change;
    return Number.isFinite(derived) && derived > 0 ? derived : null;
  }
  return null;
}

function previousCloseFromDelayedQuote(
  row: Awaited<ReturnType<typeof fetchEodhdUsQuoteDelayed>>,
): number | null {
  const prev = row?.previousClosePrice;
  return prev != null && Number.isFinite(prev) && prev > 0 ? prev : null;
}

function quotedAtSecFromRealtime(
  rt: Awaited<ReturnType<typeof fetchEodhdUsRealtime>>,
  now: Date,
): number {
  const ts = rt?.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts)) return Math.floor(ts);
  return Math.floor(now.getTime() / 1000);
}

function quotedAtSecFromDelayed(
  row: Awaited<ReturnType<typeof fetchEodhdUsQuoteDelayed>>,
  now: Date,
): number {
  const ms = row?.lastTradeTime;
  if (typeof ms === "number" && Number.isFinite(ms)) return Math.floor(ms / 1000);
  return Math.floor(now.getTime() / 1000);
}

async function fetchStockSpotQuoteUncached(ticker: string): Promise<StockSpotQuote> {
  const sym = ticker.trim();
  const now = new Date();
  if (getUsEquityMarketSession(now) === "regular") {
    const rt = await fetchEodhdUsRealtime(sym);
    if (isEodhdUsRealtimeFresh(rt, now)) {
      const live = rt?.close != null ? clampFinite(rt.close) : null;
      const previousClose = previousCloseFromRealtimePayload(rt);
      if (live != null && live > 0) {
        return { price: live, previousClose, quotedAtSec: quotedAtSecFromRealtime(rt, now) };
      }
    }

    const delayed = await fetchEodhdUsQuoteDelayed(sym);
    if (isEodhdUsQuoteDelayedFresh(delayed, now)) {
      const live =
        delayed?.lastTradePrice != null ? clampFinite(delayed.lastTradePrice) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed);
      if (live != null && live > 0) {
        return {
          price: live,
          previousClose,
          quotedAtSec: quotedAtSecFromDelayed(delayed, now),
        };
      }
    }

    if (isEodhdUsRealtimeAcceptableForDisplay(rt, now)) {
      const live = rt?.close != null ? clampFinite(rt.close) : null;
      const previousClose = previousCloseFromRealtimePayload(rt);
      if (live != null && live > 0) {
        return { price: live, previousClose, quotedAtSec: quotedAtSecFromRealtime(rt, now) };
      }
    }

    if (isEodhdUsQuoteDelayedAcceptableForDisplay(delayed, now)) {
      const live =
        delayed?.lastTradePrice != null ? clampFinite(delayed.lastTradePrice) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed);
      if (live != null && live > 0) {
        return {
          price: live,
          previousClose,
          quotedAtSec: quotedAtSecFromDelayed(delayed, now),
        };
      }
    }
  }
  const nowSec = Math.floor(now.getTime() / 1000);
  const pts = await load1DChartPoints(sym, now, nowSec);
  if (!pts.length) return { price: null, previousClose: null, quotedAtSec: null };
  const lastPt = pts[pts.length - 1]!;
  const last = lastPt.value;
  const price =
    typeof last === "number" && Number.isFinite(last) && last > 0 ? last : null;
  return {
    price,
    previousClose: null,
    quotedAtSec: typeof lastPt.time === "number" ? lastPt.time : null,
  };
}

const getStockSpotQuoteLiveSessionCached = unstable_cache(
  async (ticker: string) => fetchStockSpotQuoteUncached(ticker),
  ["stock-spot-quote-1d-live-v11-minute-store"],
  { revalidate: REVALIDATE_STOCK_1D_LIVE_SPOT },
);

const getStockSpotQuoteCached = unstable_cache(
  async (ticker: string) => fetchStockSpotQuoteUncached(ticker),
  ["stock-spot-quote-v1"],
  { revalidate: REVALIDATE_HOT },
);

/** Trust WS minute store over EODHD REST when the bar was updated recently. */
const MINUTE_STORE_SPOT_MAX_AGE_SEC = 90;

async function enhanceLiveSpotQuoteWithMinuteStore(
  ticker: string,
  quote: StockSpotQuote,
  now: Date = new Date(),
): Promise<StockSpotQuote> {
  if (getUsEquityMarketSession(now) !== "regular") return quote;

  const nowSec = Math.floor(now.getTime() / 1000);
  const sessionYmd = usSessionYmdFromUnixSeconds(nowSec);
  const sym = ticker.trim();

  const [dbLatest, memBars] = await Promise.all([
    fetchLatestStockSessionMinuteBarFromDb(sym, sessionYmd),
    Promise.resolve(getStockSessionMinuteBars(sym, sessionYmd)),
  ]);

  let minutePrice: number | null = null;
  let minuteUpdatedSec = 0;

  if (dbLatest) {
    const updatedSec = Math.floor(new Date(dbLatest.updated_at).getTime() / 1000);
    if (nowSec - updatedSec <= MINUTE_STORE_SPOT_MAX_AGE_SEC) {
      minutePrice = dbLatest.close;
      minuteUpdatedSec = updatedSec;
    }
  }

  const memLast = memBars.length ? memBars[memBars.length - 1]! : null;
  if (
    memLast &&
    Number.isFinite(memLast.value) &&
    memLast.value > 0 &&
    memLast.time >= (dbLatest?.bucket_unix ?? 0)
  ) {
    const memAsOfSec = Math.max(minuteUpdatedSec, memLast.time + 59);
    if (nowSec - memAsOfSec <= MINUTE_STORE_SPOT_MAX_AGE_SEC) {
      minutePrice = memLast.value;
      minuteUpdatedSec = memAsOfSec;
    }
  }

  if (minutePrice == null || minuteUpdatedSec <= 0) return quote;

  return {
    price: minutePrice,
    previousClose: quote.previousClose,
    quotedAtSec: minuteUpdatedSec,
  };
}

/** Live-price API + SSR hot fields — EODHD live OHLCV during regular session. */
export async function getStockSpotQuoteForApi(ticker: string): Promise<StockSpotQuote> {
  const now = new Date();
  if (getUsEquityMarketSession(now) === "regular") {
    requestStockMinuteBarWatch(ticker);
    const base = await getStockSpotQuoteLiveSessionCached(ticker);
    // Option B: header tracks EODHD realtime; minute store is chart-only (no bar-close override).
    const quote =
      base.price != null && Number.isFinite(base.price) && base.price > 0
        ? base
        : await enhanceLiveSpotQuoteWithMinuteStore(ticker, base, now);
    if (
      isStock1DLiveMinuteChartTicker(ticker) &&
      quote.price != null &&
      Number.isFinite(quote.price) &&
      quote.price > 0
    ) {
      recordStockSessionMinuteBar(ticker, quote.price, now);
    }
    return quote;
  }
  return getStockSpotQuoteCached(ticker);
}

/** Live-price API + SSR hot fields — shared cache during regular session. */
export async function getStockSpotPriceUsdForApi(ticker: string): Promise<number | null> {
  const quote = await getStockSpotQuoteForApi(ticker);
  return quote.price;
}

/**
 * Spot price aligned with the stock asset page 1D chart (intraday last bar when available).
 * Prefer {@link getStockSpotPriceUsdForApi} on stock pages so polls coalesce across users.
 */
export async function getStockSpotPriceUsd(ticker: string): Promise<number | null> {
  return getStockSpotPriceUsdForApi(ticker);
}

