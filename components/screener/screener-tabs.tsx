const secondaryTabs = ["Companies", "Gainers & Losers"] as const;
export type StocksSubTab = (typeof secondaryTabs)[number];

export function ScreenerTabs({
  active,
  onChange,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {secondaryTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`rounded-lg px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors duration-100 ${
              tab === active ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
