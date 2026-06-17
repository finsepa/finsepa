/** Stable `market_snapshot.key` values — one row per blob. */
export const MARKET_SNAPSHOT_KEY = {
  stocksAllPages: "stocks_all_pages",
  screenerDerived: "screener_derived",
  cryptoTab: "crypto_tab",
  cryptoPage2: "crypto_page2",
  cryptoDerived: "crypto_derived",
  indicesTab: "indices_tab",
  indicesDerived: "indices_derived",
  /** Screener stocks tab index strip — hot tier, built during cron. */
  indexCards: "index_cards",
  /** Top-500 screener rows with live 1D/1M/YTD fields — hot tier, 15m refresh. */
  top500Market: "top500_market",
  screenerSectors: "screener_sectors",
  screenerIndustries: "screener_industries",
  screenerGainersLosers: "screener_gainers_losers",
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

/** Quotes / tab lists — refresh every live 15m segment (or frozen day). */
export const MARKET_SNAPSHOT_HOT_INGEST_KEYS: readonly MarketSnapshotKey[] = [
  MARKET_SNAPSHOT_KEY.stocksAllPages,
  MARKET_SNAPSHOT_KEY.cryptoTab,
  MARKET_SNAPSHOT_KEY.cryptoPage2,
  MARKET_SNAPSHOT_KEY.indicesTab,
  MARKET_SNAPSHOT_KEY.indexCards,
  MARKET_SNAPSHOT_KEY.top500Market,
  MARKET_SNAPSHOT_KEY.screenerSectors,
  MARKET_SNAPSHOT_KEY.screenerIndustries,
  MARKET_SNAPSHOT_KEY.screenerGainersLosers,
];

/** EOD-bar derived blobs — once per regular session day during live hours. */
export const MARKET_SNAPSHOT_SLOW_INGEST_KEYS: readonly MarketSnapshotKey[] = [
  MARKET_SNAPSHOT_KEY.screenerDerived,
  MARKET_SNAPSHOT_KEY.cryptoDerived,
  MARKET_SNAPSHOT_KEY.indicesDerived,
];
