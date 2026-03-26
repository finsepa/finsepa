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
    <div className="mb-6 flex items-end justify-between border-b border-[#E4E4E7]">
      <div className="flex items-end gap-5">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`relative py-2 text-[14px] leading-6 font-medium transition-colors duration-100 ${
              tab === active
                ? "text-[#09090B] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#09090B] after:content-['']"
                : "text-[#71717A] hover:text-[#09090B]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
