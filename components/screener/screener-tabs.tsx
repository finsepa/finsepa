"use client";

import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";

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

export function ScreenerTabs({
  active,
  onChange,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
}) {
  return (
    <>
      <FormListboxSelect
        className="md:hidden"
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
