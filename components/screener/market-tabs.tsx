import { ChevronDown } from "lucide-react";

const tabs = ["Stocks", "Crypto", "Indices", "ETFs", "Currencies", "Commodities", "Bonds"];

export function MarketTabs() {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-[#E4E4E7]">
      <div className="flex items-end gap-5">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`relative py-2 text-[14px] leading-6 font-medium transition-colors duration-100 ${
              i === 0
                ? "text-[#09090B] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#09090B] after:content-['']"
                : "text-[#71717A] hover:text-[#09090B]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <button className="mb-2 flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300">
        <span className="text-base leading-none">🇺🇸</span>
        <span>US</span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </button>
    </div>
  );
}
