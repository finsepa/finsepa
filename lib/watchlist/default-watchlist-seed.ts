import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import type { WatchlistSectionsLayout } from "@/lib/watchlist/sections";

/** Stable section ids so SSR / client hydrate and server seed stay aligned. */
export const DEFAULT_WATCHLIST_SECTION_IDS = {
  crypto: "wls_seed_crypto",
  finance: "wls_seed_finance",
  tech: "wls_seed_tech",
} as const;

/**
 * Starter watchlist for new signups (and empty guest default).
 * Matches the Free-plan demo shape: CRYPTO / FINANCE / TECH.
 */
export const DEFAULT_WATCHLIST_SEED_ITEMS: readonly {
  ticker: string;
  sectionId: string;
}[] = [
  { ticker: cryptoWatchlistKey("BTC"), sectionId: DEFAULT_WATCHLIST_SECTION_IDS.crypto },
  { ticker: "JPM", sectionId: DEFAULT_WATCHLIST_SECTION_IDS.finance },
  { ticker: "AAPL", sectionId: DEFAULT_WATCHLIST_SECTION_IDS.tech },
  { ticker: "MSFT", sectionId: DEFAULT_WATCHLIST_SECTION_IDS.tech },
];

export function buildDefaultWatchlistSectionLayout(): WatchlistSectionsLayout {
  return {
    sections: [
      { id: DEFAULT_WATCHLIST_SECTION_IDS.crypto, name: "CRYPTO" },
      { id: DEFAULT_WATCHLIST_SECTION_IDS.finance, name: "FINANCE" },
      { id: DEFAULT_WATCHLIST_SECTION_IDS.tech, name: "TECH" },
    ],
    tickerSections: Object.fromEntries(
      DEFAULT_WATCHLIST_SEED_ITEMS.map((item) => [item.ticker, item.sectionId]),
    ),
  };
}

export function defaultWatchlistSeedTickers(): string[] {
  return DEFAULT_WATCHLIST_SEED_ITEMS.map((item) => item.ticker);
}
