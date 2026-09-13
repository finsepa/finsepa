import { Suspense } from "react";

import { MarketsSection } from "@/components/screener/markets-section";
import { ScreenerMarketChrome } from "@/components/screener/screener-market-chrome";
import { ScreenerMarketTabSkeleton } from "@/components/markets/markets-skeletons";
import { YieldForStreaming } from "@/components/stock/yield-for-streaming";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { buildScreenerMarketTabApiResponseForSsr } from "@/lib/screener/screener-page-payload";
import type { ScreenerMarketTab } from "@/lib/screener/screener-page-payload-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";
import { screenerMarketTabLabelFromParam } from "@/lib/screener/screener-market-url";

type ScreenerPageContentProps = {
  market: ScreenerMarketTab;
  stocksSector: ScreenerCanonicalSector | null;
  stocksIndustry: ScreenerIndustryDrill | null;
};

/**
 * Slim shell first: market tabs paint from the URL with no payload await.
 * Nested Suspense streams the selected market table (same pattern as `/stock` nested Suspense).
 */
export function ScreenerPageContent({
  market,
  stocksSector,
  stocksIndustry,
}: ScreenerPageContentProps) {
  const tabLabel = screenerMarketTabLabelFromParam(market);

  return (
    <div className="min-w-0 w-full max-w-full">
      <ScreenerMarketChrome market={market} />
      <Suspense fallback={<ScreenerMarketTabSkeleton tab={tabLabel} />}>
        <ScreenerMarketTabData
          market={market}
          stocksSector={stocksSector}
          stocksIndustry={stocksIndustry}
        />
      </Suspense>
    </div>
  );
}

/** Async RSC — awaited inside nested Suspense so tabs chrome can flush first. */
async function ScreenerMarketTabData({
  market,
  stocksSector,
  stocksIndustry,
}: ScreenerPageContentProps) {
  const payload = await runWithProviderTrace(`/screener ssr market=${market}`, () =>
    buildScreenerMarketTabApiResponseForSsr(market, {
      stocksSector: stocksIndustry ? null : stocksSector,
      stocksIndustry,
    }),
  );

  return (
    <YieldForStreaming>
      <MarketsSection payload={payload} showTabs={false} />
    </YieldForStreaming>
  );
}
