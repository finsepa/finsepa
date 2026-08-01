import { MARKET_INDICES_TODAY } from "@/lib/screener/indices-config";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

export type IndexComponentRow = {
  code: string;
  name: string;
  sector: string | null;
  weight: number | null;
  exchange: string | null;
};

/** EOD-only ranges — no 1D/5D intraday (unlike stock/crypto live allowlists). */
export const INDEX_CHART_RANGES = ["1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;
export type IndexChartRange = (typeof INDEX_CHART_RANGES)[number];

export function isIndexChartRange(v: string | null | undefined): v is IndexChartRange {
  return v != null && (INDEX_CHART_RANGES as readonly string[]).includes(v);
}

export type IndexPageInitialData = {
  routeSymbol: string;
  displayName: string;
  displayCode: string;
  chart: { range: IndexChartRange; points: StockChartPoint[] };
  performance: StockPerformance;
  components: IndexComponentRow[];
  showComponents: boolean;
  news: StockNewsArticle[];
};

/** Short code for UI (GSPC.INDX → GSPC, IWM.US → IWM). */
export function indexDisplayCode(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const dot = s.lastIndexOf(".");
  return dot > 0 ? s.slice(0, dot) : s;
}

export function indexAssetHref(symbol: string): string {
  return `/index/${encodeURIComponent(symbol.trim())}`;
}

/** Extra display names beyond MARKET_INDICES_TODAY (search / top-10 universe). */
const EXTRA_INDEX_DISPLAY_NAMES: Record<string, string> = {
  "BUK100P.INDX": "FTSE 100",
  "GDAXI.INDX": "DAX",
  "N225.INDX": "Nikkei 225",
  "FCHI.INDX": "CAC 40",
  "HSI.INDX": "Hang Seng",
};

/** Symbols we treat as index overview pages (cards + screener + search). */
export function isIndexPageSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  if (MARKET_INDICES_TODAY.some((row) => row.eodhdSymbol.toUpperCase() === s)) return true;
  if (EXTRA_INDEX_DISPLAY_NAMES[s]) return true;
  if (s.endsWith(".INDX")) return true;
  return false;
}

export function resolveIndexPageTitle(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const cfg = MARKET_INDICES_TODAY.find((row) => row.eodhdSymbol.toUpperCase() === s);
  if (cfg?.name) return cfg.name;
  const extra = EXTRA_INDEX_DISPLAY_NAMES[s];
  if (extra) return extra;
  return indexDisplayCode(s);
}

/** Equity indices show constituents; VIX does not. IWM uses ETF holdings. */
export function indexSupportsComponents(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (s === "VIX.INDX") return false;
  return true;
}
