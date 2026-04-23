import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_CHART_STREAM, CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockChartPoints, pricePointsToReturnIndexPoints } from "@/lib/market/stock-chart-data";
import { isStockChartRange, sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import { isStockChartSeries, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartPoints } from "@/lib/fixtures/nvda";

/** Portfolio overview benchmark fetch must still work in single-asset demo mode. */
const BENCHMARK_CHART_TICKERS = new Set(["SPY", "QQQ", "DIA", "IWM", "VTI"]);

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
    } else if (series === "return") {
      points = pricePointsToReturnIndexPoints(points);
    }
    return NextResponse.json(
      { ticker: routeTicker, range, series, points },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
    );
  }

  const routeUpper = routeTicker.trim().toUpperCase();
  if (isSingleAssetMode() && !isSupportedAsset(routeTicker) && !BENCHMARK_CHART_TICKERS.has(routeUpper)) {
    return NextResponse.json(
      { ticker: routeTicker, range, series, points: [] },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
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
        "Cache-Control": CACHE_CONTROL_PRIVATE_CHART_STREAM,
      },
    },
  );
}

