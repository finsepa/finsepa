"use client";

const tabs = [
  "Overview", "Financials", "Events", "Earnings", "Dividends",
  "Multicharts", "Target Price", "Insiders", "Superinvestors",
  "Charting", "Peers", "Holdings", "Profile",
];

export function StockTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="border-b border-[#E4E4E7]">
      <div className="flex items-center gap-5 overflow-x-hidden">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`shrink-0 py-2 text-[14px] leading-6 cursor-pointer transition-colors whitespace-nowrap ${
                isActive
                  ? "font-semibold text-[#09090B] border-b-2 border-[#09090B] -mb-px"
                  : "font-normal text-[#71717A] hover:text-[#09090B] border-b-2 border-transparent -mb-px"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
