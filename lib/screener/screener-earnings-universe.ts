import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** Same order as Screener stocks: curated top 10, then next N by market cap (page 2). */
export function listScreenerEquityTickersOrdered(universe: readonly { ticker: string }[]): string[] {
  return [...TOP10_TICKERS, ...pickScreenerPage2Tickers(universe)];
}

/**
 * Up to 500 US equities from the Top-500 snapshot (market-cap order), same source as the Screener universe layer.
 * Used by the earnings calendar allowlist so the page tracks large-cap names, not only page-1+2 quotes.
 */
export function listTop500EquityTickersOrdered(universe: readonly { ticker: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of universe) {
    const t = u.ticker.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 500) break;
  }
  return out;
}
