import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_WARM, REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { getNvdaStockEarningsTabPayload } from "@/lib/fixtures/nvda";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { fetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-data";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

export const runtime = "nodejs";
/** SEC enrichment on full mode can run many sequential fetches. */
export const maxDuration = 60;

export async function GET(request: Request, { params }: Ctx) {
  const { ticker: raw } = await params;
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const cacheControl = preview
    ? `public, s-maxage=${REVALIDATE_WARM}, stale-while-revalidate=${REVALIDATE_WARM * 2}`
    : CACHE_CONTROL_PUBLIC_WARM;

  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    return NextResponse.json(getNvdaStockEarningsTabPayload(), {
      headers: { "Cache-Control": cacheControl },
    });
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      {
        ticker: routeTicker,
        upcoming: null,
        history: [],
        estimatesChart: null,
        documentHub: { irWebsite: null, cik: null, companyWebsite: null },
      },
      { headers: { "Cache-Control": cacheControl } },
    );
  }

  const payload = await fetchStockEarningsTabPayload(routeTicker, { preview });
  if (!payload) {
    return NextResponse.json(
      {
        ticker: routeTicker,
        upcoming: null,
        history: [],
        estimatesChart: null,
        documentHub: { irWebsite: null, cik: null, companyWebsite: null },
      },
      { status: 200, headers: { "Cache-Control": cacheControl } },
    );
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": cacheControl },
  });
}
