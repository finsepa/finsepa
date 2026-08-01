import { NextResponse } from "next/server";

import { getIndexChartPoints } from "@/lib/market/index-page-initial-data";
import { isIndexChartRange, isIndexPageSymbol } from "@/lib/market/index-page-shared";
import { pricePointsToReturnIndexPoints } from "@/lib/market/stock-chart-data";
import {
  isStockChartSeries,
  type StockChartRange,
  type StockChartSeries,
} from "@/lib/market/stock-chart-types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  if (!isIndexPageSymbol(routeSymbol)) {
    return NextResponse.json({ error: "Unknown index" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: StockChartRange = isIndexChartRange(rangeParam) ? rangeParam : "1Y";
  const seriesParam = url.searchParams.get("series");
  const series: StockChartSeries = isStockChartSeries(seriesParam) ? seriesParam : "price";

  let points = await getIndexChartPoints(routeSymbol, range);
  if (series === "return") {
    points = pricePointsToReturnIndexPoints(points);
  }

  return NextResponse.json({
    symbol: routeSymbol,
    range,
    series,
    points,
  });
}
