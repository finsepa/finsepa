import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockChartPoints } from "@/lib/market/stock-chart-data";
import { isStockChartRange, sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import { isStockChartSeries, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartPoints } from "@/lib/fixtures/nvda";

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
  const range: StockChartRange = isStockChartRange(rangeParam) ? rangeParam : "1Y";
  const seriesParam = url.searchParams.get("series");
  const series: StockChartSeries = isStockChartSeries(seriesParam) ? seriesParam : "price";

  const NVDA_FIXTURE_SHARES = 2.45e9;

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.trim().toUpperCase() === "NVDA") {
    let points = getNvdaChartPoints(range);
    if (series === "marketCap") {
      points = points.map((p) => ({ ...p, value: p.value * NVDA_FIXTURE_SHARES }));
    }
    return NextResponse.json(
      { ticker: routeTicker, range, series, points },
      { headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" } },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: routeTicker, range, series, points: [] },
      { headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" } },
    );
  }

  const rawPoints = await getStockChartPoints(routeTicker, range, series);
  const points = sliceStockChartPointsForRange(rawPoints, range);

  return NextResponse.json(
    {
      ticker: routeTicker,
      range,
      series,
      points,
    },
    {
      headers: {
        "Cache-Control": "private, s-maxage=45, stale-while-revalidate=120",
      },
    },
  );
}

