"use client";

import type { CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

export type { CryptoDetailTabId };

const TABS: { id: CryptoDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "holdings", label: "Holdings" },
];

export function CryptoDetailTabNav({
  activeTab,
  onTabChange,
}: {
  activeTab: CryptoDetailTabId;
  onTabChange: (tab: CryptoDetailTabId) => void;
}) {
  return (
    <div className="border-b border-solid border-[#E4E4E7]">
      <nav className="flex flex-wrap items-start gap-5" aria-label="Crypto sections">
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
