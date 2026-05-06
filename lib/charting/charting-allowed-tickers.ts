import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/**
 * Equities allowed on `/charting` — same universe as the company picker and screener stock search
 * (screener universe; top-10 preserved first).
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
  // Allow the full screener universe so `/comparison` and charting pickers work for common tickers (e.g. PYPL).
  for (const r of universe) {
    const u = r.ticker.trim().toUpperCase();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
