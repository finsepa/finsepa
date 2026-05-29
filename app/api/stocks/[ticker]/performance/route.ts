import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_HOT } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { getStockPerformance } from "@/lib/market/stock-performance";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaPerformance } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

const getCachedPerformance = unstable_cache(
  async (ticker: string) => getStockPerformance(ticker),
  ["stock-performance-v2-annual"],
  // Performance should be reasonably fresh but cheap across tab switching.
  { revalidate: 60 },
);

export async function GET(_request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    return NextResponse.json(getNvdaPerformance(), {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT },
    });
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      {
        ticker: routeTicker,
        price: null,
        d1: null,
        d5: null,
        d7: null,
        m1: null,
        m6: null,
        ytd: null,
        y1: null,
        y5: null,
        y10: null,
        all: null,
        annualReturns: emptyAnnualReturns(),
      },
      {
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT },
      },
    );
  }

  const perf = await getCachedPerformance(routeTicker);
  return NextResponse.json(perf, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_HOT,
    },
  });
}

