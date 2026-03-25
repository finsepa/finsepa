import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs } from "@/components/screener/market-tabs";
import { ScreenerTabs } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";

export default function ScreenerPage() {
  return (
    <div className="px-9 py-6">
      <MarketTabs />
      <IndexCards />
      <div className="mb-5">
        <ScreenerTabs />
      </div>
      <ScreenerTable />
    </div>
  );
}
