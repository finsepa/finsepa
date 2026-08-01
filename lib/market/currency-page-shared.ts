import {
  SCREENER_CURRENCY_MAJORS,
  SCREENER_CURRENCY_SYMBOLS,
} from "@/lib/screener/screener-currencies-universe";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

/** EOD-only ranges — same as indices (no 1D/5D intraday). */
export const CURRENCY_CHART_RANGES = ["1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;
export type CurrencyChartRange = (typeof CURRENCY_CHART_RANGES)[number];

export function isCurrencyChartRange(v: string | null | undefined): v is CurrencyChartRange {
  return v != null && (CURRENCY_CHART_RANGES as readonly string[]).includes(v);
}

export type CurrencyPageInitialData = {
  routeSymbol: string;
  displayName: string;
  displayCode: string;
  chart: { range: CurrencyChartRange; points: StockChartPoint[] };
  performance: StockPerformance;
};

const SYMBOL_SET = new Set(SCREENER_CURRENCY_SYMBOLS.map((s) => s.toUpperCase()));

/** Short code for UI (EURUSD.FOREX → EURUSD). */
export function currencyDisplayCode(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const dot = s.lastIndexOf(".");
  return dot > 0 ? s.slice(0, dot) : s;
}

export function currencyAssetHref(symbol: string): string {
  return `/currency/${encodeURIComponent(symbol.trim())}`;
}

export function isCurrencyPageSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  if (SYMBOL_SET.has(s)) return true;
  if (s.endsWith(".FOREX") && /^[A-Z]{6}\.FOREX$/.test(s)) return true;
  return false;
}

export function resolveCurrencyPageTitle(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const hit = SCREENER_CURRENCY_MAJORS.find((p) => p.symbol.toUpperCase() === s);
  if (hit?.name) return hit.name;
  return currencyDisplayCode(s);
}
