/** Normalized item for global search + recent searches. */
export type SearchAssetItem = {
  id: string;
  type: "stock" | "crypto" | "index";
  symbol: string;
  name: string;
  /** Secondary line (e.g. exchange, pair). */
  subtitle: string | null;
  logoUrl: string | null;
  route: string;
  marketLabel: string | null;
};

export type SearchScope = "all" | "stocks" | "crypto" | "indices";
