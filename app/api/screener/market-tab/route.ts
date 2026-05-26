import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_FROZEN,
  CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_PAGE,
} from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildScreenerMarketTabApiResponse } from "@/lib/screener/screener-page-payload";
import { marketCacheSegmentFromPayload, type ScreenerMarketTab } from "@/lib/screener/screener-page-payload-types";
import { parseScreenerMarketTab, SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import {
  parseScreenerIndustryDrill,
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
} from "@/lib/screener/screener-industry-url";
import { parseScreenerSectorParam, SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const market = parseScreenerMarketTab(url.searchParams.get(SCREENER_MARKET_QUERY)) as ScreenerMarketTab;
  const sector = market === "stocks" ? parseScreenerSectorParam(url.searchParams.get(SCREENER_SECTOR_QUERY)) : null;
  const industryDrill =
    market === "stocks"
      ? parseScreenerIndustryDrill(
          url.searchParams.get(SCREENER_INDUSTRY_QUERY),
          url.searchParams.get(SCREENER_INDUSTRY_SECTOR_QUERY),
        )
      : null;

  const epoch = getScreenerUsMarketCacheEpoch();
  const cacheControl =
    epoch.mode === "frozen"
      ? CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_FROZEN
      : CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_PAGE;

  const payload = await buildScreenerMarketTabApiResponse(market, {
    stocksSector: industryDrill ? null : sector,
    stocksIndustry: industryDrill,
  });

  return NextResponse.json(
    { payload, marketCacheSegment: marketCacheSegmentFromPayload(payload) },
    { headers: { "Cache-Control": cacheControl } },
  );
}
