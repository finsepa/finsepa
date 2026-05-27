import { Suspense } from "react";

import { ScreenerBrowserTrace } from "@/components/screener/screener-browser-trace";
import { MarketsSection } from "@/components/screener/markets-section";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { buildScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import { parseScreenerMarketTab, SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import {
  parseScreenerIndustryDrill,
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
} from "@/lib/screener/screener-industry-url";
import { parseScreenerSectorParam, SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ScreenerPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = sp[SCREENER_MARKET_QUERY];
  const marketParam = Array.isArray(raw) ? raw[0] : raw;
  const market = parseScreenerMarketTab(marketParam);
  const sectorRaw = sp[SCREENER_SECTOR_QUERY];
  const sectorParam = Array.isArray(sectorRaw) ? sectorRaw[0] : sectorRaw;
  const stocksSector = market === "stocks" ? parseScreenerSectorParam(sectorParam) : null;
  const indRaw = sp[SCREENER_INDUSTRY_QUERY];
  const indSecRaw = sp[SCREENER_INDUSTRY_SECTOR_QUERY];
  const industryParam = Array.isArray(indRaw) ? indRaw[0] : indRaw;
  const industrySectorParam = Array.isArray(indSecRaw) ? indSecRaw[0] : indSecRaw;
  const stocksIndustry =
    market === "stocks" ? parseScreenerIndustryDrill(industryParam, industrySectorParam) : null;
  const payload = await runWithProviderTrace(`/screener ssr market=${market}`, () =>
    buildScreenerPagePayload(market, {
      stocksSector: stocksIndustry ? null : stocksSector,
      stocksIndustry,
    }),
  );

  return (
    <div className="min-w-0 w-full max-w-full max-md:overflow-x-hidden max-md:px-4 max-md:pb-2 max-md:pt-0 md:overflow-x-hidden md:px-9 md:py-6">
      <ScreenerBrowserTrace />
      <Suspense fallback={null}>
        <MarketsSection payload={payload} />
      </Suspense>
    </div>
  );
}
