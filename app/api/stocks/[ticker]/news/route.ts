import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockNews } from "@/lib/market/stock-news";
import type { StockNewsResponse } from "@/lib/market/stock-news-types";

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
  const routeTicker = decodeURIComponent(ticker).trim().toUpperCase();
  const items = await getStockNews(routeTicker);

  const body: StockNewsResponse = { ticker: routeTicker, items };
  return NextResponse.json(body);
}
