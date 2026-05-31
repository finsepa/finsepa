import type { SearchAssetItem } from "@/lib/search/search-types";
import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { cryptoWatchlistKey, indexWatchlistKey } from "@/lib/watchlist/constants";

/** Maps a search row to the same storage key used by watchlist APIs. */
export function watchlistStorageKeyForSearchItem(item: SearchAssetItem): string {
  if (item.type === "stock") return item.symbol.trim().toUpperCase();
  if (item.type === "crypto") {
    const base = toSupportedCryptoTicker(item.symbol) ?? item.symbol.trim().toUpperCase();
    return cryptoWatchlistKey(base);
  }
  return indexWatchlistKey(item.symbol);
}
