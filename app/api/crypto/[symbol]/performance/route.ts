import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_HOT } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCryptoPerformance } from "@/lib/market/crypto-performance";
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
    const empty = {
      ticker: routeSymbol.toUpperCase(),
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
    };
    return NextResponse.json(empty, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT },
    });
  }

  const perf = await getCryptoPerformance(routeSymbol);
  return NextResponse.json(perf, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_HOT,
    },
  });
}
