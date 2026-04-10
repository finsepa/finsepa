import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockNews, loadStockNewsPage } from "@/lib/market/stock-news";
import type { StockNewsResponse } from "@/lib/market/stock-news-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaStockNews } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

function parseOffsetLimit(request: Request): { offset: number; limit: number } {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limitRaw = Number(url.searchParams.get("limit") ?? "5") || 5;
  const limit = Math.min(20, Math.max(1, limitRaw));
  return { offset, limit };
}

export async function GET(request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim().toUpperCase();
  const { offset, limit } = parseOffsetLimit(request);

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    const all = getNvdaStockNews();
    const items = all.slice(offset, offset + limit);
    const body: StockNewsResponse = {
      ticker: routeTicker,
      items,
      hasMore: offset + items.length < all.length,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "private, s-maxage=90, stale-while-revalidate=180",
      },
    });
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    const body: StockNewsResponse = { ticker: routeTicker, items: [], hasMore: false };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "private, s-maxage=90, stale-while-revalidate=180",
      },
    });
  }

  const items =
    offset === 0 && limit === 5
      ? await getStockNews(routeTicker)
      : await loadStockNewsPage(routeTicker, offset, limit);

  const body: StockNewsResponse = {
    ticker: routeTicker,
    items,
    hasMore: items.length === limit,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, s-maxage=90, stale-while-revalidate=180",
    },
  });
}
