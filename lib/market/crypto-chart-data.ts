import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import {
  toSupportedCryptoTicker,
  toEodhdCryptoSymbol,
  fetchEodhdCryptoDailyBars,
} from "@/lib/market/eodhd-crypto";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
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
    byTime.set(p.time, p.value);
  }
  return Array.from(byTime.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
}

async function loadCryptoChartPointsUncached(symbol: string, range: StockChartRange): Promise<StockChartPoint[]> {
  const sup = toSupportedCryptoTicker(symbol);
  if (!sup) return [];
  const pair = toEodhdCryptoSymbol(sup);
  if (!pair) return [];

  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  if (range === "1D" || range === "5D") {
    const days = range === "1D" ? 1 : 5;
    const from = nowSec - days * 24 * 60 * 60;
    const interval = range === "1D" ? "5m" : "1h";
    const bars = await fetchEodhdIntraday(pair, from, nowSec, interval);
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
  ["crypto-chart-points-v2"],
  { revalidate: REVALIDATE_HOT },
);
