import type { WatchlistSection } from "@/lib/watchlist/sections";

export type WatchlistCollectionRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  sections_layout?: unknown;
};

export type WatchlistRow = {
  id: string;
  user_id: string;
  collection_id: string;
  ticker: string;
  sort_order: number;
  created_at: string;
};

export type WatchlistUserStateRow = {
  user_id: string;
  active_collection_id: string | null;
  updated_at: string;
};

export type WatchlistServerCollection = {
  id: string;
  name: string;
  sortOrder: number;
  tickers: string[];
  sections: WatchlistSection[];
  tickerSections: Record<string, string>;
};

export type WatchlistServerSnapshot = {
  collections: WatchlistServerCollection[];
  activeCollectionId: string;
  /** From `watchlist_user_state.updated_at` — used for cross-device conflict resolution. */
  updatedAt?: string | null;
};

export type WatchlistSyncCollectionInput = {
  name: string;
  tickers: string[];
  sections?: WatchlistSection[];
  tickerSections?: Record<string, string>;
};
