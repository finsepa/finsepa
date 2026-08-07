import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getCryptoLiveSpotPriceUsd } from "@/lib/market/crypto-live-price";
import { getCryptoLiveSpotForHeader } from "@/lib/market/crypto-live-spot-fresh";
import { isCryptoLive1DSymbol, normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { isSingleAssetMode } from "@/lib/features/single-asset";

type Ctx = { params: Promise<{ symbol: string }> };

/** Auth: Bearer or cookie via `resolveAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim();

  if (isSingleAssetMode()) {
    return NextResponse.json(
      { ticker: routeSymbol.toUpperCase(), price: null },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  }

  // Live 24/7 crypto (BTC): prefer the freshest source (WS → realtime → intraday → daily close) and
  // return the data timestamp + source so the header shows a moving price, not a frozen daily close.
  if (isCryptoLive1DSymbol(routeSymbol)) {
    const spot = await getCryptoLiveSpotForHeader(routeSymbol);
    if (process.env.NODE_ENV === "development") {
      console.info("[crypto-live-price api]", normalizeCryptoBaseSymbol(routeSymbol), {
        source: spot?.source ?? null,
        price: spot?.price ?? null,
        quotedAtSec: spot?.quotedAtSec ?? null,
        quotedAt: spot ? new Date(spot.quotedAtSec * 1000).toISOString() : null,
        cacheControl: "private, no-store",
      });
    }
    return NextResponse.json(
      {
        ticker: routeSymbol.toUpperCase(),
        price: spot?.price ?? null,
        quotedAtSec: spot?.quotedAtSec ?? null,
        source: spot?.source ?? null,
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  }

  const price = await getCryptoLiveSpotPriceUsd(routeSymbol);
  return NextResponse.json(
    { ticker: routeSymbol.toUpperCase(), price },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
  );
}
