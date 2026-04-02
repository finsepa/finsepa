import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";

import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

function clampFinite(n: number): number | null {
  return Number.isFinite(n) ? n : null;
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
  const byTime = new Map<number, number>();
  for (const p of points) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue;
    // last write wins
    byTime.set(p.time, p.value);
  }
  const out = Array.from(byTime.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
  return out;
}

/** Keep only bars on the UTC calendar day of the latest bar (nearest trading session when window spans multiple days). */
function trimIntradayToLatestUtcDay<T extends { timestamp: number }>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const lastTs = bars[bars.length - 1]!.timestamp;
  const d = new Date(lastTs * 1000);
  const startSec = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
  return bars.filter((b) => b.timestamp >= startSec);
}

function barsToChartPoints(bars: EodhdIntradayBar[]): StockChartPoint[] {
  return dedupeAndSort(
    bars
      .map((b) => {
        const value = clampFinite(b.close);
        if (value == null) return null;
        return { time: b.timestamp, value };
      })
      .filter(Boolean) as StockChartPoint[],
  );
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
      return { time: t, value: v };
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
      return { time: t, value: v };
    })
    .filter(Boolean) as StockChartPoint[];
  return dedupeAndSort(points);
}

/**
 * 1D: prefer intraday with progressively relaxed windows/intervals; trim multi-day pulls to the latest UTC session.
 * If no intraday exists at all, last resort is daily closes so the chart is rarely empty.
 */
async function load1DChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const strategies: { lookbackSec: number; interval: "1m" | "5m" | "1h"; trimToLatestUtcDay: boolean }[] = [
    { lookbackSec: 86400, interval: "5m", trimToLatestUtcDay: false },
    { lookbackSec: 3 * 86400, interval: "5m", trimToLatestUtcDay: true },
    { lookbackSec: 2 * 86400, interval: "1h", trimToLatestUtcDay: true },
    { lookbackSec: 7 * 86400, interval: "1h", trimToLatestUtcDay: true },
    { lookbackSec: 2 * 86400, interval: "1m", trimToLatestUtcDay: true },
    { lookbackSec: 5 * 86400, interval: "1m", trimToLatestUtcDay: true },
  ];

  for (const s of strategies) {
    const from = nowSec - s.lookbackSec;
    const bars = await fetchEodhdIntraday(ticker, from, nowSec, s.interval);
    if (process.env.NODE_ENV === "development") {
      console.info("[stock chart] 1D intraday attempt", {
        ticker,
        endpoint: "GET /api/intraday/{symbol}",
        fromUnix: from,
        toUnix: nowSec,
        interval: s.interval,
        trimToLatestUtcDay: s.trimToLatestUtcDay,
        barCount: bars?.length ?? 0,
      });
    }
    if (!bars?.length) continue;
    const use = s.trimToLatestUtcDay ? trimIntradayToLatestUtcDay(bars) : bars;
    if (!use.length) continue;
    const pts = barsToChartPoints(use);
    if (pts.length) return pts;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 1D: no intraday; last resort daily EOD", { ticker });
  }
  return loadDailyLastNCloses(ticker, now, 5, 21);
}

/**
 * 5D: intraday (1h preferred), then wider intraday; if still empty, last 5 **daily** closes.
 */
async function load5DChartPoints(ticker: string, now: Date, nowSec: number): Promise<StockChartPoint[]> {
  const tries: { lookbackSec: number; interval: "5m" | "1h" }[] = [
    { lookbackSec: 5 * 86400, interval: "1h" },
    { lookbackSec: 10 * 86400, interval: "1h" },
    { lookbackSec: 14 * 86400, interval: "5m" },
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
    const pts = barsToChartPoints(bars);
    if (pts.length) return pts;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[stock chart] 5D: intraday empty; fallback last 5 daily closes", { ticker });
  }
  return loadDailyLastNCloses(ticker, now, 5, 21);
}

async function loadStockChartPointsUncached(ticker: string, range: StockChartRange): Promise<StockChartPoint[]> {
  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  if (range === "1D") {
    return load1DChartPoints(ticker, now, nowSec);
  }
  if (range === "5D") {
    return load5DChartPoints(ticker, now, nowSec);
  }

  // Daily ranges.
  const toStr = ymdUtc(now);
  let fromDate = new Date(now);

  if (range === "1M") fromDate.setUTCDate(fromDate.getUTCDate() - 45);
  else if (range === "6M") fromDate.setUTCDate(fromDate.getUTCDate() - 210);
  else if (range === "1Y") fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  else if (range === "ALL") fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 12);
  else if (range === "YTD") {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  const fromStr = ymdUtc(fromDate);
  const bars = await fetchEodhdEodDaily(ticker, fromStr, toStr);
  if (!bars || !bars.length) return [];

  const points = bars
    .map((b) => {
      const t = parseYmdToUnixSeconds(b.date);
      const v = clampFinite(b.close);
      if (t == null || v == null) return null;
      return { time: t, value: v };
    })
    .filter(Boolean) as StockChartPoint[];

  return dedupeAndSort(points);
}

export const getStockChartPoints = unstable_cache(
  async (ticker: string, range: StockChartRange) => loadStockChartPointsUncached(ticker, range),
  ["stock-chart-points-v3"],
  { revalidate: REVALIDATE_HOT },
);

