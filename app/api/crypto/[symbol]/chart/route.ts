import { NextResponse } from "next/server";

import { cryptoMarketCapPointsFromPricePoints, getCryptoChartPoints } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { getCryptoChartPointsViaStockPipeline } from "@/lib/market/crypto-stock-pipeline-experiment.server";
import { usesCryptoStockPipelineExperiment } from "@/lib/market/crypto-stock-pipeline-experiment";
import { isCryptoLive1DSymbol, normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { pricePointsToReturnIndexPoints } from "@/lib/market/stock-chart-data";
import {
  CACHE_CONTROL_PRIVATE_CHART_STREAM,
  CACHE_CONTROL_PRIVATE_NO_STORE,
} from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { isStockChartSeries, STOCK_CHART_RANGES, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";

function isRange(v: string | null): v is StockChartRange {
  return v != null && (STOCK_CHART_RANGES as readonly string[]).includes(v);
}

type Ctx = { params: Promise<{ symbol: string }> };

/** Auth: Bearer or cookie via `resolveAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim();

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: StockChartRange = isRange(rangeParam) ? rangeParam : "1Y";
  const seriesParam = url.searchParams.get("series");
  const series: StockChartSeries = isStockChartSeries(seriesParam) ? seriesParam : "price";

  const stockPipeline = usesCryptoStockPipelineExperiment(routeSymbol);

  // Live allowlist keeps rolling 24H for range=1D. All other ranges use stock-style `.CC` loaders
  // (no US RTH filters). Legacy getCryptoChartPoints remains the fallback when pipeline is off.
  const liveCrypto1D = range === "1D" && isCryptoLive1DSymbol(routeSymbol);
  const useStockPipeline = stockPipeline && !liveCrypto1D;

  let points =
    (useStockPipeline ? await getCryptoChartPointsViaStockPipeline(routeSymbol, range) : null) ??
    (liveCrypto1D
      ? await loadCryptoLive1DMinuteChartPoints(routeSymbol)
      : await getCryptoChartPoints(routeSymbol, range));

  if (series === "return") {
    points = pricePointsToReturnIndexPoints(points);
  } else if (series === "marketCap") {
    points = await cryptoMarketCapPointsFromPricePoints(routeSymbol, points);
  }

  if ((liveCrypto1D || useStockPipeline) && process.env.NODE_ENV === "development") {
    const first = points[0];
    const last = points[points.length - 1];
    console.info("[crypto-chart-api]", normalizeCryptoBaseSymbol(routeSymbol), {
      range,
      series,
      pointCount: points.length,
      stockPipeline: useStockPipeline,
      firstPointTime: first ? new Date(first.time * 1000).toISOString() : null,
      lastPointTime: last ? new Date(last.time * 1000).toISOString() : null,
    });
  }

  const headers = liveCrypto1D
    ? { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE }
    : useStockPipeline
      ? { "Cache-Control": CACHE_CONTROL_PRIVATE_CHART_STREAM }
      : undefined;

  return NextResponse.json(
    {
      symbol: routeSymbol,
      range,
      series,
      points,
      ...(useStockPipeline ? { pipeline: "crypto-stock-v3" } : {}),
    },
    headers ? { headers } : undefined,
  );
}
