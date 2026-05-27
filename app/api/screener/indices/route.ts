import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_FROZEN,
  CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_PAGE,
} from "@/lib/data/cache-policy";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

export async function GET() {
  const epoch = getScreenerUsMarketCacheEpoch();
  const cacheControl =
    epoch.mode === "frozen"
      ? CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_FROZEN
      : CACHE_CONTROL_PRIVATE_SCREENER_COMPANIES_PAGE;
  const cards = await runWithProviderTrace("/api/screener/indices", () => getSimpleIndexCards());

  return NextResponse.json(
    { cards, marketCacheSegment: epoch.segment, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": cacheControl,
      },
    },
  );
}

