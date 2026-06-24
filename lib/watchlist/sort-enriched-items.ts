import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

/** Sort enriched rows to match the user's watchlist ticker order. */
export function sortEnrichedItemsByTickerOrder(
  items: WatchlistEnrichedItem[],
  tickerOrder: string[],
): WatchlistEnrichedItem[] {
  if (!tickerOrder.length) return items;

  const rank = new Map(
    tickerOrder.map((ticker, index) => [normalizeWatchlistStorageKey(ticker), index]),
  );

  return [...items].sort((left, right) => {
    const leftRank = rank.get(normalizeWatchlistStorageKey(left.storageKey)) ?? Number.MAX_SAFE_INTEGER;
    const rightRank =
      rank.get(normalizeWatchlistStorageKey(right.storageKey)) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}
