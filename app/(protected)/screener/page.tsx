import { Suspense } from "react";

import { ScreenerBrowserTrace } from "@/components/screener/screener-browser-trace";
import { ScreenerContentSkeleton } from "@/components/screener/screener-content-skeleton";
import { ScreenerPageContent } from "@/components/screener/screener-page-content";
import {
  parseScreenerMarketTab,
  SCREENER_MARKET_QUERY,
  screenerMarketTabLabelFromParam,
} from "@/lib/screener/screener-market-url";
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
  return (
    <div className="min-w-0 w-full max-w-full max-md:overflow-x-hidden max-md:px-4 max-md:pb-2 max-md:pt-0 md:overflow-x-hidden md:px-9 md:py-6">
      <ScreenerBrowserTrace />
      <Suspense fallback={<ScreenerContentSkeleton market={screenerMarketTabLabelFromParam(market)} />}>
        <ScreenerPageContent
          market={market}
          stocksSector={stocksSector}
          stocksIndustry={stocksIndustry}
        />
      </Suspense>
    </div>
  );
}
