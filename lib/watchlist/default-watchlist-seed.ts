import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import { emptyWatchlistSectionLayout, type WatchlistSectionsLayout } from "@/lib/watchlist/sections";

/** Starter watchlist for new signups (and empty guest default). */
export const DEFAULT_WATCHLIST_SEED_TICKERS: readonly string[] = [
  cryptoWatchlistKey("BTC"),
  "JPM",
  "AAPL",
  "MSFT",
];

/** Watchlists no longer have sections — seeds start with an empty layout. */
export function buildDefaultWatchlistSectionLayout(): WatchlistSectionsLayout {
  return emptyWatchlistSectionLayout();
}

export function defaultWatchlistSeedTickers(): string[] {
  return [...DEFAULT_WATCHLIST_SEED_TICKERS];
}
