import { SCREENER_PAGE2_STOCK_QUOTE_COUNT } from "@/lib/screener/screener-scale-config";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** @deprecated Use {@link SCREENER_PAGE2_STOCK_QUOTE_COUNT} — kept for existing imports. */
export const SCREENER_PAGE2_TICKER_COUNT = SCREENER_PAGE2_STOCK_QUOTE_COUNT;

/**
 * Next N US names by market cap after the curated page-1 list (same rule as screener realtime + EOD derived).
 */
export function pickScreenerPage2Tickers(universe: readonly { ticker: string }[]): string[] {
  const page1 = new Set(TOP10_TICKERS.map((t) => t.toUpperCase()));
  const out: string[] = [];
  for (const u of universe) {
    const t = u.ticker.trim().toUpperCase();
    if (!t || page1.has(t)) continue;
    out.push(t);
    if (out.length >= SCREENER_PAGE2_STOCK_QUOTE_COUNT) break;
  }
  return out;
}
