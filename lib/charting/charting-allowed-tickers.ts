import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/**
 * Equities allowed on `/charting` — same universe as the company picker and screener stock search
 * (page-1 top 10 + page-2 caps from the static screener universe).
 */
export function buildChartingAllowedTickerList(universe: readonly { ticker: string }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of TOP10_TICKERS) {
    const u = t.trim().toUpperCase();
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  for (const t of pickScreenerPage2Tickers(universe)) {
    const u = t.trim().toUpperCase();
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}
