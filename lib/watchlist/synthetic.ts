import type { WatchlistRow } from "@/lib/watchlist/types";
import { normalizeWatchlistTicker } from "@/lib/watchlist/operations";

/** Build DB-shaped rows from client tickers for enrichment-only APIs (no Supabase row ids). */
export function syntheticWatchlistRows(rawTickers: string[]): WatchlistRow[] {
  const out: WatchlistRow[] = [];
  for (let i = 0; i < rawTickers.length; i++) {
    try {
      const ticker = normalizeWatchlistTicker(rawTickers[i]!);
      out.push({
        id: `syn-${ticker}-${i}`,
        user_id: "",
        ticker,
        created_at: new Date(0).toISOString(),
      });
    } catch {
      /* skip invalid */
    }
  }
  return out;
}
