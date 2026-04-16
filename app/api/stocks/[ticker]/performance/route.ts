import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockPerformance } from "@/lib/market/stock-performance";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaPerformance } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

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
      headers: { "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120" },
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
      },
      {
        headers: { "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120" },
      },
    );
  }

  const perf = await getStockPerformance(routeTicker);
  return NextResponse.json(perf, {
    headers: {
      "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120",
    },
  });
}

