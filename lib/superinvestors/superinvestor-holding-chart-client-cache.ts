import type { StockChartPoint } from "@/lib/market/stock-chart-types";

type CacheEntry = { dateKey: string; points: StockChartPoint[] };

const cache = new Map<string, CacheEntry>();

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function superinvestorHoldingChartCacheKey(
  symbol: string,
  range: string,
  series: string,
): string {
  return `${symbol.trim().toUpperCase()}|${range}|${series}`;
}

export function readSuperinvestorHoldingChartCache(key: string): StockChartPoint[] | null {
  const entry = cache.get(key);
  if (!entry || entry.dateKey !== utcDateKey()) return null;
  return entry.points;
}

export function writeSuperinvestorHoldingChartCache(key: string, points: StockChartPoint[]): void {
  cache.set(key, { dateKey: utcDateKey(), points });
}
