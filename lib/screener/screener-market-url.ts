/** Query key for Screener market tab (Stocks / Crypto / Indices). */
export const SCREENER_MARKET_QUERY = "market" as const;

/** Server + URL parsing — safe for client bundles (no `server-only` imports). */
export type ScreenerMarketTabParam = "stocks" | "crypto" | "indices";

export function parseScreenerMarketTab(raw: string | null | undefined): ScreenerMarketTabParam {
  const v = raw?.trim().toLowerCase();
  if (v === "crypto") return "crypto";
  if (v === "indices") return "indices";
  return "stocks";
}

/** Deep link: Screener with Crypto tab active. */
export const SCREENER_CRYPTO_HREF = `/screener?${SCREENER_MARKET_QUERY}=crypto` as const;

/** Deep link: Screener with Indices tab active. */
export const SCREENER_INDICES_HREF = `/screener?${SCREENER_MARKET_QUERY}=indices` as const;
