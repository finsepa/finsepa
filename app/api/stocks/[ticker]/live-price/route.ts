import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_HOT,
  CACHE_CONTROL_PRIVATE_NO_STORE,
} from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockSpotQuoteForApi } from "@/lib/market/stock-chart-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartPoints } from "@/lib/fixtures/nvda";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

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
  const session = getUsEquityMarketSession(new Date());
  const cacheControl =
    session === "regular" ? CACHE_CONTROL_PRIVATE_NO_STORE : CACHE_CONTROL_PRIVATE_HOT;

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && upper === "NVDA") {
    const pts = getNvdaChartPoints("1D");
    const last = pts.length ? pts[pts.length - 1]!.value : null;
    const price =
      typeof last === "number" && Number.isFinite(last) && last > 0 ? last : null;
    const quotedAtSec = Math.floor(Date.now() / 1000);
    if (process.env.NODE_ENV === "development") {
      console.log("[live-price]", upper, { price, quotedAtSec, session });
    }
    return NextResponse.json(
      { ticker: upper, price, quotedAtSec },
      { headers: { "Cache-Control": cacheControl } },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: upper, price: null, quotedAtSec: null },
      { headers: { "Cache-Control": cacheControl } },
    );
  }

  const quote = await getStockSpotQuoteForApi(routeTicker);
  const quotedAtSec =
    quote.quotedAtSec != null && Number.isFinite(quote.quotedAtSec)
      ? quote.quotedAtSec
      : Math.floor(Date.now() / 1000);

  if (process.env.NODE_ENV === "development") {
    console.log("[live-price]", upper, {
      price: quote.price,
      quotedAtSec,
      previousClose: quote.previousClose,
      session,
    });
  }

  return NextResponse.json(
    { ticker: upper, price: quote.price, previousClose: quote.previousClose, quotedAtSec },
    { headers: { "Cache-Control": cacheControl } },
  );
}
