import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset, SINGLE_ASSET_SYMBOL } from "@/lib/features/single-asset";
import { getNvdaHeaderMeta } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(_request: Request, { params }: Ctx) {
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

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      {
        ticker: routeTicker,
        fullName: null,
        logoUrl: null,
        exchange: null,
        sector: null,
        industry: null,
        earningsDateDisplay: null,
        watchlistCount: null,
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
    );
  }

  const meta = isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.trim().toUpperCase() === SINGLE_ASSET_SYMBOL ? getNvdaHeaderMeta() : await getStockDetailHeaderMetaForPage(routeTicker);

  return NextResponse.json(
    {
      ticker: routeTicker,
      fullName: meta.fullName,
      logoUrl: meta.logoUrl,
      exchange: meta.exchange,
      sector: meta.sector,
      industry: meta.industry,
      earningsDateDisplay: meta.earningsDateDisplay,
      watchlistCount: meta.watchlistCount,
    },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART,
      },
    },
  );
}
