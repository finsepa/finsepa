import { NextResponse } from "next/server";

import { fetchEodhdStockProfile } from "@/lib/market/eodhd-stock-profile";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaProfile } from "@/lib/fixtures/nvda";

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

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    return NextResponse.json(
      { ticker: routeTicker, profile: getNvdaProfile() },
      {
        headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: routeTicker, profile: null },
      {
        status: 200,
        headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  }

  const profile = await fetchEodhdStockProfile(routeTicker);
  if (!profile) {
    return NextResponse.json(
      { ticker: routeTicker, profile: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

  return NextResponse.json(
    { ticker: routeTicker, profile },
    {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
