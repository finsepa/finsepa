import { Settings2 } from "lucide-react";

const secondaryTabs = [
  "Companies",
  "Sectors",
  "Industries",
  "Trending",
  "Gainers & Losers",
  "Most Visited",
];

export function ScreenerTabs() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {secondaryTabs.map((tab, i) => (
          <button
            key={tab}
            className={`rounded-lg px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors duration-100 ${
              i === 0 ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <button className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-600 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:border-neutral-300 hover:text-neutral-900">
        <Settings2 className="h-3.5 w-3.5" />
        Customize
      </button>
    </div>
  );
}
