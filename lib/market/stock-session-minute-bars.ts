import "server-only";

import { stock1DLiveSessionMinuteBucketUnix } from "@/lib/chart/stock-1d-live-session-chart";
import { STOCK_DISPLAY_TZ, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import {
  fetchStockSessionMinuteBarsFromDb,
  upsertStockSessionMinuteBarToDb,
} from "@/lib/market/stock-session-minute-bar-store";
import { sessionMinuteBarsHavePriceVariation } from "@/lib/market/stock-ws-priority-universe";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

type SessionMinuteBarStore = Map<string, StockChartPoint[]>;

type GlobalWithSessionMinuteBars = typeof globalThis & {
  __finsepaStockSessionMinuteBars?: SessionMinuteBarStore;
};

function store(): SessionMinuteBarStore {
  const g = globalThis as GlobalWithSessionMinuteBars;
  if (!g.__finsepaStockSessionMinuteBars) {
    g.__finsepaStockSessionMinuteBars = new Map();
  }
  return g.__finsepaStockSessionMinuteBars;
}

function storeKey(ticker: string, sessionYmd: string): string {
  return `${ticker.trim().toUpperCase()}:${sessionYmd}`;
}

function recordStockSessionMinuteBarMemory(
  ticker: string,
  price: number,
  now: Date,
): StockChartPoint | null {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return null;

  const nowSec = Math.floor(now.getTime() / 1000);
  const sessionYmd = usSessionYmdFromUnixSeconds(nowSec);
  const bucket = stock1DLiveSessionMinuteBucketUnix(sessionYmd, nowSec, STOCK_DISPLAY_TZ);
  const point: StockChartPoint = {
    time: bucket,
    value: price,
    sessionDate: sessionYmd,
    timeZone: STOCK_DISPLAY_TZ,
  };

  const k = storeKey(sym, sessionYmd);
  const existing = store().get(k) ?? [];
  const idx = existing.findIndex((p) => p.time === bucket);
  if (idx >= 0) {
    if (existing[idx]!.value === price) return point;
    const next = [...existing];
    next[idx] = point;
    store().set(
      k,
      next.sort((a, b) => a.time - b.time),
    );
    return point;
  }

  store().set(
    k,
    [...existing, point].sort((a, b) => a.time - b.time),
  );
  return point;
}

/** Record one live spot close on the 9:30-anchored minute grid (memory L1 + Supabase tail). */
export function recordStockSessionMinuteBar(
  ticker: string,
  price: number,
  now: Date = new Date(),
): void {
  if (getUsEquityMarketSession(now) !== "regular") return;
  if (!Number.isFinite(price) || price <= 0) return;

  const point = recordStockSessionMinuteBarMemory(ticker, price, now);
  if (!point?.sessionDate) return;

  void upsertStockSessionMinuteBarToDb(
    ticker,
    point.sessionDate,
    point.time,
    point.value,
  );
}

export function getStockSessionMinuteBars(ticker: string, sessionYmd: string): StockChartPoint[] {
  return store().get(storeKey(ticker, sessionYmd)) ?? [];
}

export function mergeStockChartPointsByTime(
  sources: readonly (readonly StockChartPoint[])[],
): StockChartPoint[] {
  const byTime = new Map<number, StockChartPoint>();
  for (const points of sources) {
    for (const p of points) {
      if (typeof p.time === "number" && Number.isFinite(p.time) && Number.isFinite(p.value)) {
        byTime.set(p.time, p);
      }
    }
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

export type MergeStockSessionMinuteBarsOptions = {
  /** Keep flat minute bars during the live session (chart time grid, not WS quality gate). */
  includeFlatBars?: boolean;
};

function filterSessionMinuteBarsForMerge(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  now: Date,
  options?: MergeStockSessionMinuteBarsOptions,
): StockChartPoint[] {
  if (!bars.length) return [];
  if (options?.includeFlatBars || getUsEquityMarketSession(now) !== "regular") {
    return [...bars];
  }
  if (!sessionMinuteBarsHavePriceVariation(bars, sessionYmd, STOCK_DISPLAY_TZ, now)) {
    return [];
  }
  return [...bars];
}

/** Merge polled minute closes into chart source bars (later sources win on the same bucket). */
export function mergeStockSessionMinuteBars(
  ticker: string,
  sessionYmd: string,
  points: readonly StockChartPoint[],
  now: Date = new Date(),
  options?: MergeStockSessionMinuteBarsOptions,
): StockChartPoint[] {
  const bars = filterSessionMinuteBarsForMerge(
    getStockSessionMinuteBars(ticker, sessionYmd),
    sessionYmd,
    now,
    options,
  );
  if (!bars.length) return [...points];
  return mergeStockChartPointsByTime([points, bars]);
}

/** Async merge: Supabase minute store + warm-instance memory over fallback chart points. */
export async function mergeStockSessionMinuteBarsFromDb(
  ticker: string,
  sessionYmd: string,
  points: readonly StockChartPoint[],
  now: Date = new Date(),
  options?: MergeStockSessionMinuteBarsOptions,
): Promise<StockChartPoint[]> {
  const [dbBarsRaw, memBarsRaw] = await Promise.all([
    fetchStockSessionMinuteBarsFromDb(ticker, sessionYmd),
    Promise.resolve(getStockSessionMinuteBars(ticker, sessionYmd)),
  ]);

  const dbBars = filterSessionMinuteBarsForMerge(dbBarsRaw, sessionYmd, now, options);
  const memBars = filterSessionMinuteBarsForMerge(memBarsRaw, sessionYmd, now, options);

  if (!dbBars.length && !memBars.length) return [...points];
  return mergeStockChartPointsByTime([points, dbBars, memBars]);
}

export { fetchStockSessionMinuteBarsFromDb } from "@/lib/market/stock-session-minute-bar-store";
