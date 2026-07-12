import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

/**
 * Order-independent enrichment cache key: normalized, deduplicated, sorted tickers.
 * Drag/reorder must not change this key when membership is unchanged.
 */
export function buildWatchlistMembershipKey(tickers: readonly string[]): string {
  const normalized = [
    ...new Set(
      tickers
        .map((t) => normalizeWatchlistStorageKey(t.trim()))
        .filter((t) => t.length > 0),
    ),
  ].sort();
  return normalized.join("|");
}
