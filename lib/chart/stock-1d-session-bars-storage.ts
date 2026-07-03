import type { StockChartPoint } from "@/lib/market/stock-chart-types";

const STORAGE_PREFIX = "finsepa:1d-session-bars:";

function storageKey(symbol: string, sessionYmd: string): string {
  return `${STORAGE_PREFIX}${symbol.trim().toUpperCase()}:${sessionYmd}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Client-side 60s session history — survives reloads within the same browser/day. */
export function readStock1DSessionBarsFromStorage(
  symbol: string,
  sessionYmd: string,
): StockChartPoint[] {
  if (!isBrowser() || !sessionYmd) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(symbol, sessionYmd));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is StockChartPoint =>
          p != null &&
          typeof p === "object" &&
          typeof (p as StockChartPoint).time === "number" &&
          Number.isFinite((p as StockChartPoint).time) &&
          typeof (p as StockChartPoint).value === "number" &&
          Number.isFinite((p as StockChartPoint).value),
      )
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export function writeStock1DSessionBarsToStorage(
  symbol: string,
  sessionYmd: string,
  bars: readonly StockChartPoint[],
): void {
  if (!isBrowser() || !sessionYmd || !bars.length) return;
  try {
    window.localStorage.setItem(storageKey(symbol, sessionYmd), JSON.stringify(bars));
  } catch {
    /* quota / private mode */
  }
}

export function mergeStock1DSessionBarInStorage(
  symbol: string,
  sessionYmd: string,
  bar: StockChartPoint,
): StockChartPoint[] {
  const existing = readStock1DSessionBarsFromStorage(symbol, sessionYmd);
  const byTime = new Map<number, StockChartPoint>();
  for (const p of existing) byTime.set(p.time, p);
  byTime.set(bar.time, bar);
  const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  writeStock1DSessionBarsToStorage(symbol, sessionYmd, merged);
  return merged;
}
