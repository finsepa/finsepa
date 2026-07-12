import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { getStockKeyIndicators, stockKeyIndicatorsEnabled } from "@/lib/market/stock-key-indicators-service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (!stockKeyIndicatorsEnabled()) {
    return NextResponse.json({ ticker: "", computedAt: null, indicators: [] });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();

  try {
    const payload = await getStockKeyIndicators(routeTicker);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM },
    });
  } catch {
    return NextResponse.json(
      { ticker: routeTicker.toUpperCase(), computedAt: null, indicators: [] },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
    );
  }
}
