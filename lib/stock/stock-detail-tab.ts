/** Stock asset page tabs — shared so server `page.tsx` and client `stock-page-content` stay in sync for hydration. */

export type StockDetailTabId =
  | "overview"
  | "financials"
  | "earnings"
  | "multicharts"
  | "target-price"
  | "insiders"
  | "charting"
  | "peers"
  | "holdings"
  | "profile";

export function parseStockDetailTabQuery(raw: string | null | undefined): StockDetailTabId | null {
  if (
    raw === "overview" ||
    raw === "financials" ||
    raw === "earnings" ||
    raw === "multicharts" ||
    raw === "target-price" ||
    raw === "insiders" ||
    raw === "charting" ||
    raw === "peers" ||
    raw === "holdings" ||
    raw === "profile"
  ) {
    return raw;
  }
  return null;
}
