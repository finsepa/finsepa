import { SecondaryTabs } from "@/components/ui/secondary-tabs";

export const SCREENER_STOCKS_SUB_TAB_ITEMS = [
  { id: "Companies", label: "Companies" },
  { id: "Gainers & Losers", label: "Gainers & Losers" },
  { id: "Sectors", label: "Sectors" },
] as const;

export type StocksSubTab = (typeof SCREENER_STOCKS_SUB_TAB_ITEMS)[number]["id"];

export function ScreenerTabs({
  active,
  onChange,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
}) {
  return (
    <SecondaryTabs
      aria-label="Stocks view"
      items={SCREENER_STOCKS_SUB_TAB_ITEMS}
      value={active}
      onValueChange={onChange}
    />
  );
}
