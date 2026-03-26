import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockChartPoints } from "@/lib/market/stock-chart-data";
import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

function isRange(v: string | null): v is StockChartRange {
  return v != null && (STOCK_CHART_RANGES as readonly string[]).includes(v);
}

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: StockChartRange = isRange(rangeParam) ? rangeParam : "1Y";

  const points = await getStockChartPoints(routeTicker, range);

  return NextResponse.json({
    ticker: routeTicker,
    range,
    points,
  });
}

