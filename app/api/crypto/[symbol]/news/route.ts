import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCryptoNews } from "@/lib/market/crypto-news";
import type { StockNewsResponse } from "@/lib/market/stock-news-types";
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
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();

  if (isSingleAssetMode()) {
    const body: StockNewsResponse = { ticker: routeSymbol, items: [] };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "private, s-maxage=90, stale-while-revalidate=180",
      },
    });
  }

  const items = await getCryptoNews(routeSymbol);
  const body: StockNewsResponse = { ticker: routeSymbol, items };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, s-maxage=90, stale-while-revalidate=180",
    },
  });
}
