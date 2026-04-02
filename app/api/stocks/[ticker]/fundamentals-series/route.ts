import { NextResponse } from "next/server";

import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartingSeriesPoints } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
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

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") === "quarterly" ? "quarterly" : "annual";
  const mode: FundamentalsSeriesMode = period === "quarterly" ? "quarterly" : "annual";

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.trim().toUpperCase() === "NVDA") {
    const points = getNvdaChartingSeriesPoints(mode === "quarterly" ? "quarterly" : "annual");
    return NextResponse.json(
      {
        ticker: routeTicker,
        period,
        points,
        availableMetrics: [],
      },
      { headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" } },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: routeTicker, period, points: [], availableMetrics: [] },
      { headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" } },
    );
  }

  const bundle = await fetchChartingSeries(routeTicker, mode);

  return NextResponse.json(
    {
      ticker: routeTicker,
      period,
      points: bundle?.points ?? [],
      availableMetrics: bundle?.availableMetrics ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
