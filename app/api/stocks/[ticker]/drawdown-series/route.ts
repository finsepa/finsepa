import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import { fetchTwentyYearDrawdownSeries } from "@/lib/market/eodhd-max-drawdown";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

const getCachedDrawdownSeries = unstable_cache(
  async (ticker: string) => fetchTwentyYearDrawdownSeries(ticker),
  ["stock-drawdown-series-v1-20y"],
  { revalidate: 12 * 60 * 60 },
);

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

  const points = await getCachedDrawdownSeries(routeTicker);
  if (!points?.length) {
    return NextResponse.json({ ticker: routeTicker, points: null }, { status: 200 });
  }

  return NextResponse.json(
    { ticker: routeTicker, points },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
  );
}
