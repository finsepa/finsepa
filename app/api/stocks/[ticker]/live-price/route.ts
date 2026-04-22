import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockSpotPriceUsd } from "@/lib/market/stock-chart-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartPoints } from "@/lib/fixtures/nvda";

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
  const upper = routeTicker.toUpperCase();

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && upper === "NVDA") {
    const pts = getNvdaChartPoints("1D");
    const last = pts.length ? pts[pts.length - 1]!.value : null;
    const price =
      typeof last === "number" && Number.isFinite(last) && last > 0 ? last : null;
    return NextResponse.json(
      { ticker: upper, price },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: upper, price: null },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  }

  const price = await getStockSpotPriceUsd(routeTicker);
  return NextResponse.json(
    { ticker: upper, price },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
  );
}
