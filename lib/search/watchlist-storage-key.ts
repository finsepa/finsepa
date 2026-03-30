import type { SearchAssetItem } from "@/lib/search/search-types";
import { cryptoWatchlistKey, indexWatchlistKey } from "@/lib/watchlist/constants";

/** Maps a search row to the same storage key used by watchlist APIs. */
export function watchlistStorageKeyForSearchItem(item: SearchAssetItem): string {
  if (item.type === "stock") return item.symbol.trim().toUpperCase();
  if (item.type === "crypto") return cryptoWatchlistKey(item.symbol);
  return indexWatchlistKey(item.symbol);
}
