import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { fetchEodhdCryptoDailyBars } from "@/lib/market/eodhd-crypto";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { rangeStartUnixSeconds } from "@/lib/market/stock-chart-api";
import { minGapDownsampleChartPoints, twoSamplesPerDayByKey } from "@/lib/market/stock-chart-data";
import { STOCK_CHART_ALL_LOOKBACK_YEARS, type StockChartPoint, type StockChartRange } from "@/lib/market/stock-chart-types";

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
    byTime.set(p.time, p.value);
  }
  return Array.from(byTime.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
}

async function loadCryptoChartPointsUncached(symbol: string, range: StockChartRange): Promise<StockChartPoint[]> {
  const meta = await resolveCryptoMetaForProvider(symbol);
  if (!meta) return [];
  const pair = meta.eodhdSymbol;

  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  if (range === "1D") {
    const from = nowSec - 86400;
    const bars = await fetchEodhdIntraday(pair, from, nowSec, "5m");
    if (!bars?.length) return [];
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

  if (range === "5D") {
    const tenMin = 10 * 60;
    const strategies: { lookbackSec: number; interval: "5m" | "1m" }[] = [
      { lookbackSec: 14 * 86400, interval: "5m" },
      { lookbackSec: 10 * 86400, interval: "5m" },
      { lookbackSec: 9 * 86400, interval: "1m" },
    ];
    for (const s of strategies) {
      const bars = await fetchEodhdIntraday(pair, nowSec - s.lookbackSec, nowSec, s.interval);
      if (!bars?.length) continue;
      let pts = dedupeAndSort(
        bars
          .map((b) => {
            const value = clampFinite(b.close);
            if (value == null) return null;
            return { time: b.timestamp, value };
          })
          .filter(Boolean) as StockChartPoint[],
      );
      const start = rangeStartUnixSeconds("5D", now);
      if (start != null) pts = pts.filter((p) => p.time >= start);
      pts = minGapDownsampleChartPoints(pts, tenMin);
      if (pts.length) return pts;
    }
    const bars1h = await fetchEodhdIntraday(pair, nowSec - 10 * 86400, nowSec, "1h");
    if (!bars1h?.length) return [];
    let pts = dedupeAndSort(
      bars1h
        .map((b) => {
          const value = clampFinite(b.close);
          if (value == null) return null;
          return { time: b.timestamp, value };
        })
        .filter(Boolean) as StockChartPoint[],
    );
    const start = rangeStartUnixSeconds("5D", now);
    if (start != null) pts = pts.filter((p) => p.time >= start);
    return pts;
  }

  if (range === "1M") {
    const oneMonthGapSec = 30 * 60;
    const strategies: { lookbackSec: number; interval: "5m" | "1m" | "1h" }[] = [
      { lookbackSec: 42 * 86400, interval: "5m" },
      { lookbackSec: 55 * 86400, interval: "5m" },
      { lookbackSec: 34 * 86400, interval: "1m" },
      { lookbackSec: 42 * 86400, interval: "1h" },
      { lookbackSec: 55 * 86400, interval: "1h" },
    ];
    for (const s of strategies) {
      const bars = await fetchEodhdIntraday(pair, nowSec - s.lookbackSec, nowSec, s.interval);
      if (!bars?.length) continue;
      let pts = dedupeAndSort(
        bars
          .map((b) => {
            const value = clampFinite(b.close);
            if (value == null) return null;
            return { time: b.timestamp, value };
          })
          .filter(Boolean) as StockChartPoint[],
      );
      if (pts.length < 36) continue;
      pts = minGapDownsampleChartPoints(pts, oneMonthGapSec);
      if (pts.length < 18) continue;
      return pts;
    }
  }

  if (range === "6M") {
    const utcDayKey = (p: StockChartPoint) => new Date(p.time * 1000).toISOString().slice(0, 10);
    const strategies: { lookbackSec: number; interval: "1h" | "5m" }[] = [
      { lookbackSec: 235 * 86400, interval: "1h" },
      { lookbackSec: 220 * 86400, interval: "5m" },
      { lookbackSec: 200 * 86400, interval: "5m" },
    ];
    for (const s of strategies) {
      const bars = await fetchEodhdIntraday(pair, nowSec - s.lookbackSec, nowSec, s.interval);
      if (!bars?.length) continue;
      let pts = dedupeAndSort(
        bars
          .map((b) => {
            const value = clampFinite(b.close);
            if (value == null) return null;
            return { time: b.timestamp, value };
          })
          .filter(Boolean) as StockChartPoint[],
      );
      if (pts.length < 120) continue;
      pts = twoSamplesPerDayByKey(pts, utcDayKey);
      if (pts.length < 60) continue;
      return pts;
    }
  }

  if (range === "YTD") {
    const ytdStartSec = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
    const utcDayKey = (p: StockChartPoint) => new Date(p.time * 1000).toISOString().slice(0, 10);
    for (const interval of ["1h", "5m"] as const) {
      const bars = await fetchEodhdIntraday(pair, ytdStartSec, nowSec, interval);
      if (!bars?.length) continue;
      let pts = dedupeAndSort(
        bars
          .map((b) => {
            const value = clampFinite(b.close);
            if (value == null) return null;
            return { time: b.timestamp, value };
          })
          .filter(Boolean) as StockChartPoint[],
      );
      pts = pts.filter((p) => p.time >= ytdStartSec);
      if (pts.length < 15) continue;
      pts = twoSamplesPerDayByKey(pts, utcDayKey);
      if (pts.length < 4) continue;
      return pts;
    }
  }

  const toStr = ymdUtc(now);
  let fromDate = new Date(now);

  if (range === "1M") fromDate.setUTCDate(fromDate.getUTCDate() - 45);
  else if (range === "6M") fromDate.setUTCDate(fromDate.getUTCDate() - 210);
  else if (range === "1Y") fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  else if (range === "5Y") fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 5);
  else if (range === "ALL") fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  else if (range === "YTD") {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  const fromStr = ymdUtc(fromDate);
  const bars = await fetchEodhdCryptoDailyBars(pair, fromStr, toStr);
  if (!bars?.length) return [];

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

export const getCryptoChartPoints = unstable_cache(
  async (symbol: string, range: StockChartRange) => loadCryptoChartPointsUncached(symbol, range),
  ["crypto-chart-points-v12-all-maxhist"],
  { revalidate: REVALIDATE_HOT },
);
