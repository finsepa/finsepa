import {
  chartingTickersToParam,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";

const STORAGE_KEY = "finsepa:comparison-tickers-v1";

/** Max companies on `/comparison` and stock Peers tab. */
export const COMPARISON_MAX_COMPANIES = 5;

export function capComparisonTickers(tickers: string[]): string[] {
  return parseChartingTickerList(chartingTickersToParam(tickers)).slice(0, COMPARISON_MAX_COMPANIES);
}

/** Persisted compare list — shared by `/comparison` and stock `?tab=peers`. */
export function readComparisonSessionTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseChartingTickerList(raw);
  } catch {
    return [];
  }
}

export function writeComparisonSessionTickers(tickers: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = capComparisonTickers(tickers);
    if (!normalized.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, chartingTickersToParam(normalized));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Anchor symbol first; dedupe; cap handled by caller. */
export function mergeComparisonAnchorTickers(
  tickers: string[],
  anchor: string,
): string[] {
  const anchorU = anchor.trim().toUpperCase();
  if (!anchorU) return parseChartingTickerList(chartingTickersToParam(tickers));
  const rest = parseChartingTickerList(chartingTickersToParam(tickers)).filter((t) => t !== anchorU);
  return [anchorU, ...rest];
}

export function buildStockPeersComparePath(ticker: string, compareTickers: string[]): string {
  const sym = ticker.trim().toUpperCase();
  const p = new URLSearchParams({ tab: "peers" });
  const tq = chartingTickersToParam(compareTickers);
  if (tq) p.set("compare", tq);
  return `/stock/${encodeURIComponent(sym)}?${p.toString()}`;
}
