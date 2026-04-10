export type WatchlistEnrichedItem = {
  entryId: string;
  /** Raw value stored in DB (e.g. AAPL or CRYPTO:BTC) */
  storageKey: string;
  symbol: string;
  name: string;
  kind: "stock" | "crypto" | "index";
  href: string;
  logoUrl: string | null;
  price: number | null;
  pct1d: number | null;
  pct1m: number | null;
  ytd: number | null;
  mcapDisplay: string;
  peDisplay: string;
  earningsDisplay: string;
};
