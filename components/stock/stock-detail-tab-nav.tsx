"use client";

import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { ETF_STOCK_DETAIL_TAB_IDS } from "@/lib/stock/stock-etf";

export type { StockDetailTabId };

/** Order matches stock Web App Design. */
const TABS: { id: StockDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "financials", label: "Financials" },
  { id: "earnings", label: "Earnings" },
  { id: "multicharts", label: "Multicharts" },
  { id: "target-price", label: "Target Price" },
  { id: "insiders", label: "Insiders" },
  { id: "superinvestors", label: "Superinvestors" },
  { id: "charting", label: "Charting" },
  { id: "peers", label: "Peers" },
  { id: "holdings", label: "Holdings" },
  { id: "profile", label: "Profile" },
];

/** Underline tabs (same pattern as Markets on screener) — below header / price on stock asset page. */
export function StockDetailTabNav({
  activeTab,
  onTabChange,
  isEtf = false,
}: {
  activeTab: StockDetailTabId;
  onTabChange: (tab: StockDetailTabId) => void;
  /** When true, only Overview and Holdings tabs are shown. */
  isEtf?: boolean;
}) {
  const tabs = isEtf
    ? TABS.filter((t) => (ETF_STOCK_DETAIL_TAB_IDS as readonly string[]).includes(t.id))
    : TABS;

  return (
    <div className="sticky top-0 z-40 bg-white max-md:mx-0 max-md:px-3 max-md:pt-1 sm:-mx-9 sm:-mt-5 sm:px-9 sm:pt-2">
      <div className="border-b border-solid border-[#E4E4E7]">
        <nav
          className="-mx-1 flex flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] sm:mx-0 sm:flex-wrap sm:gap-5 sm:overflow-visible"
          aria-label="Stock sections"
        >
          {tabs.map(({ id, label }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`-mb-px shrink-0 cursor-pointer border-b-2 border-solid py-2 text-left text-[14px] leading-6 transition-colors duration-100 ${
                  isActive
                    ? "border-[#09090B] font-semibold text-[#09090B]"
                    : "border-transparent font-medium text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function StockDetailTabPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-2 pt-1">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">{title}</h2>
      <p className="max-w-md text-[14px] leading-6 text-[#71717A]">{message}</p>
    </div>
  );
}
