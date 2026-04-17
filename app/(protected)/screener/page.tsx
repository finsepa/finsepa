import { Suspense } from "react";

import { ScreenerBrowserTrace } from "@/components/screener/screener-browser-trace";
import { MarketsSection } from "@/components/screener/markets-section";
import { buildScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import { parseScreenerMarketTab, SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ScreenerPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = sp[SCREENER_MARKET_QUERY];
  const marketParam = Array.isArray(raw) ? raw[0] : raw;
  const market = parseScreenerMarketTab(marketParam);
  const payload = await buildScreenerPagePayload(market);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <ScreenerBrowserTrace />
      <Suspense fallback={null}>
        <MarketsSection payload={payload} />
      </Suspense>
    </div>
  );
}
