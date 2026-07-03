import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_STOCK_1D_LIVE_CHART, REVALIDATE_STOCK_1D_LIVE_SPOT, REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

import { resampleStock1DLiveSession } from "@/lib/chart/stock-1d-live-session-chart";
import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import {
  isEodhdUsQuoteDelayedAcceptableForDisplay,
  isEodhdUsQuoteDelayedFresh,
  isEodhdUsQuoteDelayedFromTodaySession,
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
import { touchStockSessionMinuteBarWatch } from "@/lib/market/stock-session-minute-bar-store";
import { sessionMinuteBarsHavePriceVariation } from "@/lib/market/stock-ws-priority-universe";
import {
  getUsEquityMarketSession,
  lastCompletedUsRegularSessionYmd,
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

  recordStockSessionMinuteBar(ticker, close, now);

  const nowSec = Math.floor(now.getTime() / 1000);
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(todayYmd, 16, 0, STOCK_DISPLAY_TZ);
  const endSec = Math.min(nowSec, closeSec);

  let tailSec = endSec;
  if (
    sessionStampOk &&
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
  return mergeStockChartPointsByTime([points, [tail]]);
}

async function load1DTodaySessionPollBars(
  ticker: string,
  sessionYmd: string,
): Promise<StockChartPoint[]> {
  const [dbBars, memBars] = await Promise.all([
    fetchStockSessionMinuteBarsFromDb(ticker, sessionYmd),
    Promise.resolve(getStockSessionMinuteBars(ticker, sessionYmd)),
  ]);
  return mergeStockChartPointsByTime([dbBars, memBars]);
}

const LIVE_1D_INTRADAY_STRATEGIES: {
  fromSessionOpen?: boolean;
  lookbackSec?: number;
  interval: "1m" | "5m" | "1h";
  trimToLatestUtcDay: boolean;
}[] = [
  { fromSessionOpen: true, interval: "1m", trimToLatestUtcDay: false },
  { fromSessionOpen: true, interval: "5m", trimToLatestUtcDay: false },
  { lookbackSec: 86400, interval: "1m", trimToLatestUtcDay: false },
  { lookbackSec: 86400, interval: "5m", trimToLatestUtcDay: false },
  { lookbackSec: 3 * 86400, interval: "1m", trimToLatestUtcDay: true },
  { lookbackSec: 3 * 86400, interval: "5m", trimToLatestUtcDay: true },
  { lookbackSec: 2 * 86400, interval: "1h", trimToLatestUtcDay: true },
  { lookbackSec: 7 * 86400, interval: "1h", trimToLatestUtcDay: true },
];

async function load1DIntradayForSessionYmd(
  ticker: string,
  sessionYmd: string,
  now: Date,
): Promise<StockChartPoint[]> {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  for (const interval of ["1m", "5m", "1h"] as const) {
    const bars = await fetchEodhdIntraday(ticker, openSec, closeSec, interval);
    if (!bars?.length) continue;
    const points = barsToChartPoints(bars);
    const regular = filterToUsRegularSessionPoints(points);
    const source = regular.length ? regular : points;
    const sessionOnly = source.filter((p) => {
      const ymd = p.sessionDate?.trim() || usSessionYmdFromUnixSeconds(p.time);
      return ymd === sessionYmd;
    });
    const finalized = minGapDownsampleChartPoints(
      sessionOnly.length ? sessionOnly : source,
      STOCK_1D_CLOSED_SESSION_BAR_GAP_SEC,
    );
    if (finalized.length >= 2) return finalized;
  }
  return [];
}

/** No finalized 1m bars for today after the open — typical on US market holidays. */
async function isTodayUsSessionIntradayAbsent(
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

async function load1DIntradayChartPoints(
  ticker: string,
  now: Date,
  nowSec: number,
): Promise<StockChartPoint[]> {
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 9, 30, STOCK_DISPLAY_TZ);
  const regular = getUsEquityMarketSession(now) === "regular";

  for (const s of LIVE_1D_INTRADAY_STRATEGIES) {
    const from = s.fromSessionOpen ? openSec : nowSec - (s.lookbackSec ?? 86400);
    const bars = await fetchEodhdIntraday(ticker, from, nowSec, s.interval);
    if (process.env.NODE_ENV === "development") {
      console.info("[stock chart] 1D intraday attempt", {
        ticker,
        interval: s.interval,
        fromUnix: from,
        toUnix: nowSec,
        trimToLatestUtcDay: s.trimToLatestUtcDay,
        barCount: bars?.length ?? 0,
      });
    }
    if (!bars?.length) continue;
    const trimmed = s.trimToLatestUtcDay ? trimIntradayToLatestUtcDay(bars) : bars;
    const use = regular
      ? trimIntradayToLatestUsSessionDay(trimmed)
      : trimIntradayToLastUsRegularSessionDay(trimmed);
    if (!use.length) continue;
    const finalized = finalize1DIntradayPoints(barsToChartPoints(use), now);
    if (finalized.length) return finalized;
  }
  return [];
}

/** True when 1D should poll minute store + live OHLCV during US regular session. */
export function isStock1DLiveSessionMinuteChart(_ticker: string, now: Date = new Date()): boolean {
  return getUsEquityMarketSession(now) === "regular";
}

/**
 * 1D during regular session: Supabase/memory minute bars + live OHLCV tail (no intraday REST).
 * After close: EODHD intraday 1m when finalized.
 */
async function load1DChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  if (getUsEquityMarketSession(now) === "regular") {
    const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
    const pollBars = await load1DTodaySessionPollBars(ticker, todayYmd);

    if (
      pollBars.length >= 2 &&
      sessionMinuteBarsHavePriceVariation(pollBars, todayYmd, STOCK_DISPLAY_TZ, now)
    ) {
      return append1DRealtimeTail(ticker, pollBars, now);
    }

    if (await isTodayUsSessionIntradayAbsent(ticker, todayYmd, nowSec)) {
      const lastSessionYmd = lastCompletedUsRegularSessionYmd(now, STOCK_DISPLAY_TZ);
      if (lastSessionYmd !== todayYmd) {
        const priorSession = await load1DIntradayForSessionYmd(ticker, lastSessionYmd, now);
        if (priorSession.length) return priorSession;
      }
    }

    if (pollBars.length) {
      const anchors = await build1DRealtimeSessionAnchorPoints(ticker, now);
      const withOpen = mergeStockChartPointsByTime([anchors, pollBars]);
      return append1DRealtimeTail(ticker, withOpen, now);
    }

    const anchors = await build1DRealtimeSessionAnchorPoints(ticker, now);
    if (anchors.length) {
      return append1DRealtimeTail(ticker, anchors, now);
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[stock chart] 1D: no minute bars during regular session", { ticker });
    }
    return [];
  }

  const intraday = await load1DIntradayChartPoints(ticker, now, nowSec);
  if (intraday.length) return intraday;

  const sessionYmd = lastCompletedUsRegularSessionYmd(now, STOCK_DISPLAY_TZ);
  const pollBars = await load1DTodaySessionPollBars(ticker, sessionYmd);
  if (pollBars.length >= 2) {
    return finalize1DIntradayPoints(pollBars, now);
  }
  if (pollBars.length) return pollBars;

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 1D: no intraday; last resort daily EOD", { ticker });
  }
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 21);
  const dailyBars = await fetchEodhdEodDaily(ticker, ymdUtc(fromDate), ymdUtc(now));
  if (!dailyBars?.length) return [];
  return synthesize1DSessionChartFromDailyBars(dailyBars, now);
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
  ["stock-chart-points-v29-closed-1d-2m"],
  { revalidate: REVALIDATE_HOT },
);

/** ~30s cache for 1D during US regular session (minute store + live OHLCV tail). */
const getStockChartPoints1DLiveSession = unstable_cache(
  async (ticker: string, series: StockChartSeries) =>
    loadStockChartPointsUncached(ticker, "1D", series),
  ["stock-chart-1d-live-session-v28-minute-store"],
  { revalidate: REVALIDATE_STOCK_1D_LIVE_CHART },
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
  if (range === "1D" && getUsEquityMarketSession(now) === "regular") {
    requestStockMinuteBarWatch(ticker);
    return getStockChartPoints1DLiveSession(ticker, series);
  }
  return getStockChartPoints(ticker, range, series);
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

async function fetchStockSpotQuoteUncached(ticker: string): Promise<StockSpotQuote> {
  const sym = ticker.trim();
  const now = new Date();
  if (getUsEquityMarketSession(now) === "regular") {
    const rt = await fetchEodhdUsRealtime(sym);
    if (isEodhdUsRealtimeFresh(rt, now)) {
      const live = rt?.close != null ? clampFinite(rt.close) : null;
      const previousClose = previousCloseFromRealtimePayload(rt);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }

    const delayed = await fetchEodhdUsQuoteDelayed(sym);
    if (isEodhdUsQuoteDelayedFresh(delayed, now)) {
      const live =
        delayed?.lastTradePrice != null ? clampFinite(delayed.lastTradePrice) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }

    if (isEodhdUsRealtimeAcceptableForDisplay(rt, now)) {
      const live = rt?.close != null ? clampFinite(rt.close) : null;
      const previousClose = previousCloseFromRealtimePayload(rt);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }

    if (isEodhdUsQuoteDelayedAcceptableForDisplay(delayed, now)) {
      const live =
        delayed?.lastTradePrice != null ? clampFinite(delayed.lastTradePrice) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }

    if (
      isEodhdUsRealtimeFromTodaySession(rt, now) ||
      isEodhdUsRealtimeOhlcvUsableDuringRegularSession(rt, now)
    ) {
      const live = rt?.close != null ? clampFinite(rt.close) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed) ?? previousCloseFromRealtimePayload(rt);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }

    if (isEodhdUsQuoteDelayedFromTodaySession(delayed, now)) {
      const live =
        delayed?.lastTradePrice != null ? clampFinite(delayed.lastTradePrice) : null;
      const previousClose = previousCloseFromDelayedQuote(delayed);
      if (live != null && live > 0) {
        return { price: live, previousClose };
      }
    }
  }
  const nowSec = Math.floor(now.getTime() / 1000);
  const pts = await load1DChartPoints(sym, now, nowSec);
  if (!pts.length) return { price: null, previousClose: null };
  const last = pts[pts.length - 1]!.value;
  const price =
    typeof last === "number" && Number.isFinite(last) && last > 0 ? last : null;
  return { price, previousClose: null };
}

const getStockSpotQuoteLiveSessionCached = unstable_cache(
  async (ticker: string) => fetchStockSpotQuoteUncached(ticker),
  ["stock-spot-quote-1d-live-v10"],
  { revalidate: REVALIDATE_STOCK_1D_LIVE_SPOT },
);

const getStockSpotQuoteCached = unstable_cache(
  async (ticker: string) => fetchStockSpotQuoteUncached(ticker),
  ["stock-spot-quote-v1"],
  { revalidate: REVALIDATE_HOT },
);

/** Live-price API + SSR hot fields — EODHD live OHLCV during regular session. */
export async function getStockSpotQuoteForApi(ticker: string): Promise<StockSpotQuote> {
  const now = new Date();
  if (getUsEquityMarketSession(now) === "regular") {
    requestStockMinuteBarWatch(ticker);
  }
  const quote =
    getUsEquityMarketSession(now) === "regular"
      ? await getStockSpotQuoteLiveSessionCached(ticker)
      : await getStockSpotQuoteCached(ticker);
  if (
    getUsEquityMarketSession(now) === "regular" &&
    quote.price != null &&
    quote.price > 0
  ) {
    recordStockSessionMinuteBar(ticker, quote.price, now);
  }
  return quote;
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

