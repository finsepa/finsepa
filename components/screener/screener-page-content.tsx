import { MarketsSection } from "@/components/screener/markets-section";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { buildScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import type { ScreenerMarketTab } from "@/lib/screener/screener-page-payload-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";

export async function ScreenerPageContent({
  market,
  stocksSector,
  stocksIndustry,
}: {
  market: ScreenerMarketTab;
  stocksSector: ScreenerCanonicalSector | null;
  stocksIndustry: ScreenerIndustryDrill | null;
}) {
  const payload = await runWithProviderTrace(`/screener ssr market=${market}`, () =>
    buildScreenerPagePayload(market, {
      stocksSector: stocksIndustry ? null : stocksSector,
      stocksIndustry,
    }),
  );

  return <MarketsSection payload={payload} />;
}
