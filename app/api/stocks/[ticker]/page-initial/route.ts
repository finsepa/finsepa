import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

/**
 * Aggregated stock detail payload for native clients (iOS).
 * Reuses SSR `loadStockPageInitialData` (snapshot + single-flight cold miss).
 * Auth: Bearer or cookie via `resolveAuthUserFromRequest`.
 */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker: raw } = await params;
  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const data = await loadStockPageInitialData(routeTicker);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Slim DTO — omit fundamentals series / peers / earnings tab (not on iOS overview yet).
  return NextResponse.json(
    {
      ticker: data.ticker,
      isEtf: data.isEtf,
      headerMeta: {
        fullName: data.headerMeta.fullName,
        logoUrl: data.headerMeta.logoUrl,
        exchange: data.headerMeta.exchange,
        countryIso: data.headerMeta.countryIso,
        sector: data.headerMeta.sector,
        industry: data.headerMeta.industry,
        earningsDateDisplay: data.headerMeta.earningsDateDisplay,
        watchlistCount: data.headerMeta.watchlistCount,
        screenerRank: data.headerMeta.screenerRank,
      },
      performance: {
        price: data.performance.price,
        d1: data.performance.d1,
      },
      headerLiveSpotUsd: data.headerLiveSpotUsd,
      headerPriorCloseUsd: data.headerPriorCloseUsd,
      liveRegularSessionActive: data.liveRegularSessionActive,
      keyStatsBundle: data.keyStatsBundle,
      news: (data.news ?? []).slice(0, 12).map((n) => ({
        id: n.id,
        title: n.title,
        source: n.source,
        publishedAt: n.publishedAt,
        url: n.url,
      })),
      profile: data.profile,
    },
    {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE },
    },
  );
}
