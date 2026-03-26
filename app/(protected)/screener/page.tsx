import { IndexCards } from "@/components/screener/index-cards";
import { MarketsSection } from "@/components/screener/markets-section";
import { getTop10ScreenerRows } from "@/lib/screener/top10-quotes";

export default async function ScreenerPage() {
  const rows = await getTop10ScreenerRows();

  return (
    <div className="px-9 py-6">
      <MarketsSection stockRows={rows} />
    </div>
  );
}
