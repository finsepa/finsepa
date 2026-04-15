"use client";

import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

export type { StockDetailTabId };

const TABS: { id: StockDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "holdings", label: "Holdings" },
  { id: "charting", label: "Charting" },
  { id: "peers", label: "Peers" },
  { id: "earnings", label: "Earnings" },
  { id: "insiders", label: "Insiders" },
  { id: "profile", label: "Profile" },
];

/** Underline tabs (same pattern as Markets on screener) — below header / price on stock asset page. */
export function StockDetailTabNav({
  activeTab,
  onTabChange,
}: {
  activeTab: StockDetailTabId;
  onTabChange: (tab: StockDetailTabId) => void;
}) {
  return (
    <div className="border-b border-solid border-[#E4E4E7]">
      <nav className="flex flex-wrap items-start gap-5" aria-label="Stock sections">
        {TABS.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`-mb-px cursor-pointer border-b-2 border-solid py-2 text-left text-[14px] leading-6 transition-colors duration-100 ${
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
