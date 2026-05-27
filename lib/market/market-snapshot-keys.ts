/** Stable `market_snapshot.key` values — one row per blob. */
export const MARKET_SNAPSHOT_KEY = {
  stocksAllPages: "stocks_all_pages",
  screenerDerived: "screener_derived",
  cryptoTab: "crypto_tab",
  cryptoPage2: "crypto_page2",
  cryptoDerived: "crypto_derived",
  indicesTab: "indices_tab",
  indicesDerived: "indices_derived",
} as const;

export type MarketSnapshotKey = (typeof MARKET_SNAPSHOT_KEY)[keyof typeof MARKET_SNAPSHOT_KEY];

export const MARKET_SNAPSHOT_INGEST_KEYS: readonly MarketSnapshotKey[] = [
  MARKET_SNAPSHOT_KEY.stocksAllPages,
  MARKET_SNAPSHOT_KEY.screenerDerived,
  MARKET_SNAPSHOT_KEY.cryptoTab,
  MARKET_SNAPSHOT_KEY.cryptoPage2,
  MARKET_SNAPSHOT_KEY.cryptoDerived,
  MARKET_SNAPSHOT_KEY.indicesTab,
  MARKET_SNAPSHOT_KEY.indicesDerived,
];
