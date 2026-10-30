import type { SearchAssetItem } from "@/lib/search/search-types";

/** Quote fields for search rows — read from cron `market_snapshot` blobs only (never EODHD on request). */
export type SearchDirectoryQuote = {
  price: number | null;
  /** 1D % change (US session for equities, 24h-style daily for crypto). */
  changePct: number | null;
  marketCapUsd: number | null;
  /** Company name when the row was built from a bare ticker (search quotes endpoint only). */
  name?: string;
};

export type SearchDirectoryCategory = "stock" | "etf" | "crypto" | "index";

/** Compact browse row; client turns it into a {@link SearchAssetItem}. */
export type SearchDirectoryRow = SearchDirectoryQuote & {
  category: SearchDirectoryCategory;
  symbol: string;
  name: string;
};

export type SearchDirectoryPayload = {
  builtAt: string;
  /** Market-cap order within each category. */
  rows: SearchDirectoryRow[];
  superinvestors: SearchAssetItem[];
};
