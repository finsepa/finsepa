import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_CHART_STREAM } from "@/lib/data/cache-policy";
import { getCurrencyChartPoints } from "@/lib/market/currency-page-initial-data";
import { isCurrencyChartRange, isCurrencyPageSymbol } from "@/lib/market/currency-page-shared";
import { pricePointsToReturnIndexPoints } from "@/lib/market/stock-chart-data";
import {
  isStockChartSeries,
  type StockChartRange,
  type StockChartSeries,
} from "@/lib/market/stock-chart-types";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";

type Ctx = { params: Promise<{ symbol: string }> };

/** Auth: Bearer or cookie via `resolveAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  if (!isCurrencyPageSymbol(routeSymbol)) {
    return NextResponse.json({ error: "Unknown currency pair" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: StockChartRange = isCurrencyChartRange(rangeParam) ? rangeParam : "1D";
  const seriesParam = url.searchParams.get("series");
  const series: StockChartSeries = isStockChartSeries(seriesParam) ? seriesParam : "price";

  let points = await getCurrencyChartPoints(routeSymbol, range);
  if (series === "return") {
    points = pricePointsToReturnIndexPoints(points);
  }

  return NextResponse.json(
    {
      symbol: routeSymbol,
      range,
      series,
      points,
      pipeline: "currency-stock-v1",
    },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_CHART_STREAM } },
  );
}
