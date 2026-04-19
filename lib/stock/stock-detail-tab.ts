/** Stock asset page tabs — shared so server `page.tsx` and client `stock-page-content` stay in sync for hydration. */

export type StockDetailTabId =
  | "overview"
  | "holdings"
  | "charting"
  | "multicharts"
  | "peers"
  | "earnings"
  | "insiders"
  | "profile";

export function parseStockDetailTabQuery(raw: string | null | undefined): StockDetailTabId | null {
  if (
    raw === "overview" ||
    raw === "holdings" ||
    raw === "charting" ||
    raw === "multicharts" ||
    raw === "peers" ||
    raw === "earnings" ||
    raw === "insiders" ||
    raw === "profile"
  ) {
    return raw;
  }
  return null;
}
