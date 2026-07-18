"use client";

import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";
import { cn } from "@/lib/utils";

export const SCREENER_STOCKS_SUB_TAB_ITEMS = [
  { id: "Companies", label: "Companies" },
  { id: "Gainers & Losers", label: "Gainers & Losers" },
  { id: "Sectors", label: "Sectors" },
  { id: "Industries", label: "Industries" },
] as const;

export type StocksSubTab = (typeof SCREENER_STOCKS_SUB_TAB_ITEMS)[number]["id"];

const SCREENER_STOCKS_SUB_TAB_OPTIONS = SCREENER_STOCKS_SUB_TAB_ITEMS.map(({ id, label }) => ({
  value: id,
  label,
}));

/** Mobile stocks table: pill tabs (active grey fill, inactive transparent) — matches portfolio holdings tabs. */
export function ScreenerStocksSubTabMobileToggle({
  active,
  onChange,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
}) {
  return (
    <div
      className="mobile-scroll-x flex flex-nowrap items-center gap-1"
      role="tablist"
      aria-label="Stocks view"
    >
      {SCREENER_STOCKS_SUB_TAB_ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium leading-5 transition-colors duration-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2",
              isActive ? "bg-[#F4F4F5] text-[#0F0F0F]" : "bg-transparent text-[#71717A]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ScreenerTabs({
  active,
  onChange,
  hideMobileDropdown = false,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
  /** When the mobile toggle is embedded in the Companies table card. */
  hideMobileDropdown?: boolean;
}) {
  return (
    <>
      <FormListboxSelect
        className={cn("md:hidden", hideMobileDropdown && "hidden")}
        value={active}
        onChange={onChange}
        options={SCREENER_STOCKS_SUB_TAB_OPTIONS}
        aria-label="Stocks view"
      />
      <SecondaryTabs
        className="hidden md:block"
        aria-label="Stocks view"
        items={SCREENER_STOCKS_SUB_TAB_ITEMS}
        value={active}
        onValueChange={onChange}
      />
    </>
  );
}
