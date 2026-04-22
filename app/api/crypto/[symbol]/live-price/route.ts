import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCryptoLiveSpotPriceUsd } from "@/lib/market/crypto-live-price";
import { isSingleAssetMode } from "@/lib/features/single-asset";

type Ctx = { params: Promise<{ symbol: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const price = await getCryptoLiveSpotPriceUsd(routeSymbol);
  return NextResponse.json(
    { ticker: routeSymbol.toUpperCase(), price },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
  );
}
