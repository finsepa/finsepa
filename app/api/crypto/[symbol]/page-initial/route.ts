import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { loadCryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";

type Ctx = { params: Promise<{ symbol: string }> };

/**
 * Aggregated crypto detail payload for native clients (iOS).
 * Reuses SSR `loadCryptoPageInitialData` (snapshot + single-flight cold miss).
 * Auth: Bearer or cookie via `resolveAuthUserFromRequest`.
 */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol: raw } = await params;
  const routeSymbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!routeSymbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const data = await loadCryptoPageInitialData(routeSymbol);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const asset = data.asset
    ? {
        symbol: data.asset.symbol,
        name: data.asset.name,
        marketCap: data.asset.marketCap,
        fullyDilutedMarketCap: data.asset.fullyDilutedMarketCap,
        athMarketCap: data.asset.athMarketCap,
        totalSupply: data.asset.totalSupply,
        circulatingSupply: data.asset.circulatingSupply,
        maxSupply: data.asset.maxSupply,
        volume24h: data.asset.volume24h,
        volumeToMarketCap24h: data.asset.volumeToMarketCap24h,
      }
    : null;

  // Slim DTO — omit chart points / news / links (client fetches chart separately).
  return NextResponse.json(
    {
      routeSymbol: data.routeSymbol,
      asset,
      performance: {
        price: data.performance.price,
        d1: data.performance.d1,
      },
      headerLiveSpotUsd: data.headerLiveSpotUsd,
    },
    {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE },
    },
  );
}
