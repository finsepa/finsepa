import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cryptoMarketCapPointsFromPricePoints, getCryptoChartPoints } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { isCryptoLive1DSymbol, normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { pricePointsToReturnIndexPoints } from "@/lib/market/stock-chart-data";
import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import { isStockChartSeries, STOCK_CHART_RANGES, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";

function isRange(v: string | null): v is StockChartRange {
  return v != null && (STOCK_CHART_RANGES as readonly string[]).includes(v);
}

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
  const routeSymbol = decodeURIComponent(symbol).trim();

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: StockChartRange = isRange(rangeParam) ? rangeParam : "1Y";
  const seriesParam = url.searchParams.get("series");
  const series: StockChartSeries = isStockChartSeries(seriesParam) ? seriesParam : "price";

  // Live crypto 1D pipeline (BTC only): rolling last-24h WS minute bars, uncached + no-store,
  // client polls ~60s. All other ranges/symbols keep the existing cached daily/intraday path.
  const liveCrypto1D = range === "1D" && isCryptoLive1DSymbol(routeSymbol);

  /** Windowing is already applied inside the loaders; avoid a second slice that can drop the whole series. */
  let points = liveCrypto1D
    ? await loadCryptoLive1DMinuteChartPoints(routeSymbol)
    : await getCryptoChartPoints(routeSymbol, range);
  if (series === "return") {
    points = pricePointsToReturnIndexPoints(points);
  } else if (series === "marketCap") {
    points = await cryptoMarketCapPointsFromPricePoints(routeSymbol, points);
  }

  if (liveCrypto1D && process.env.NODE_ENV === "development") {
    const first = points[0];
    const last = points[points.length - 1];
    console.info("[crypto-chart-api]", normalizeCryptoBaseSymbol(routeSymbol), {
      range,
      series,
      pointCount: points.length,
      firstPointTime: first ? new Date(first.time * 1000).toISOString() : null,
      lastPointTime: last ? new Date(last.time * 1000).toISOString() : null,
      cacheControl: "no-store",
    });
  }

  return NextResponse.json(
    {
      symbol: routeSymbol,
      range,
      series,
      points,
    },
    liveCrypto1D ? { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } } : undefined,
  );
}
