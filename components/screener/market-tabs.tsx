const tabs = ["Stocks", "Crypto", "Indices"] as const;
export type MarketTab = (typeof tabs)[number];

/** Primary underline tabs — shared by Screener (Stocks/Crypto/Indices) and Portfolio (Overview/Performance/Cash/…). */
export function UnderlineTabs<T extends string>({
  tabs: tabList,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="mb-4 border-b border-solid border-[#E4E4E7] md:mb-6">
      <nav
        className="-mx-1 flex flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] md:mx-0 md:gap-5 md:overflow-visible"
        aria-label={ariaLabel}
      >
        {tabList.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`-mb-px shrink-0 cursor-pointer border-b-2 border-solid py-2 text-left text-[14px] font-medium leading-6 text-[#09090B] transition-colors duration-100 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2 ${
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

export function MarketTabs({
  active,
  onChange,
}: {
  active: MarketTab;
  onChange: (tab: MarketTab) => void;
}) {
  return <UnderlineTabs tabs={tabs} active={active} onChange={onChange} ariaLabel="Markets" />;
}
