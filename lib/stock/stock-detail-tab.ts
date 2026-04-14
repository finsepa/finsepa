/** Stock asset page tabs — shared so server `page.tsx` and client `stock-page-content` stay in sync for hydration. */

export type StockDetailTabId = "overview" | "holdings" | "charting" | "peers" | "profile";

export function parseStockDetailTabQuery(raw: string | null | undefined): StockDetailTabId | null {
  if (
    raw === "overview" ||
    raw === "holdings" ||
    raw === "charting" ||
    raw === "peers" ||
    raw === "profile"
  ) {
    return raw;
  }
  return null;
}
