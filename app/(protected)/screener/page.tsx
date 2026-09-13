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

/**
 * Slim shell first: market tabs paint from the URL (no payload await).
 * Nested Suspense streams the selected market body — same progressive pattern as `/stock`.
 */
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
    <div className="min-w-0 w-full max-w-full max-md:px-4 max-md:pb-2 max-md:pt-0 md:px-9 md:py-6">
      <ScreenerBrowserTrace />
      {/*
        Outer Suspense covers soft-nav into /screener (loading.tsx shares the same skeleton).
        ScreenerPageContent returns chrome immediately; nested Suspense streams the tab payload.
      */}
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
