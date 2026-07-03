import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

/** Order matches stock Web App Design — shared by in-page nav and mobile top bar. */
export const STOCK_DETAIL_TAB_ITEMS: { id: StockDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "financials", label: "Financials" },
  { id: "earnings", label: "Earnings" },
  { id: "multicharts", label: "Multicharts" },
  { id: "target-price", label: "Target Price" },
  { id: "insiders", label: "Insiders" },
  { id: "superinvestors", label: "Superinvestors" },
  { id: "charting", label: "Charting" },
  { id: "peers", label: "Peers" },
  { id: "holdings", label: "Portfolio" },
  { id: "profile", label: "Profile" },
];
