/** Normalized item for global search + recent searches. */
export type SearchAssetItem = {
  id: string;
  type: "stock" | "crypto" | "index" | "superinvestor";
  symbol: string;
  name: string;
  /** Secondary line (e.g. exchange, pair). */
  subtitle: string | null;
  logoUrl: string | null;
  route: string;
  marketLabel: string | null;
};

export type SearchScope = "all" | "stocks" | "crypto" | "indices" | "equities";

/** Common stocks only — excludes ETF/ETN rows (still `type: "stock"` in search). */
export function isCommonStockSearchItem(item: SearchAssetItem): boolean {
  return item.type === "stock" && item.marketLabel?.trim().toUpperCase() !== "ETF";
}
