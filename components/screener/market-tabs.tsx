const tabs = ["Stocks", "Crypto", "Indices"] as const;
export type MarketTab = (typeof tabs)[number];

export function MarketTabs({
  active,
  onChange,
}: {
  active: MarketTab;
  onChange: (tab: MarketTab) => void;
}) {
  return (
    <div className="mb-6 border-b border-solid border-[#E4E4E7]">
      <nav className="flex items-start gap-5" aria-label="Markets">
        {tabs.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`-mb-px cursor-pointer border-b-2 border-solid py-2 text-left text-[14px] font-medium leading-6 text-[#09090B] transition-colors duration-100 ${
                isActive ? "border-[#09090B]" : "border-transparent hover:opacity-80"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
