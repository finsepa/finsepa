import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_CHART_STREAM,
  CACHE_CONTROL_PRIVATE_NO_STORE,
  CACHE_CONTROL_PRIVATE_SUPERINVESTOR_HOLDING_CHART,
  CACHE_CONTROL_PRIVATE_WARM_CHART,
} from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStockChartPointsForApi,
  getSuperinvestorHoldingStockChartPoints,
  isStock1DLiveSessionMinuteChart,
  pricePointsToReturnIndexPoints,
} from "@/lib/market/stock-chart-data";
import { usesStock1DLiveWsMinutePipeline, usesStock1DLiveWsPostMarketChart } from "@/lib/market/stock-1d-live-minute-chart-tickers";
import { isStockChartRange, sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import { isStockChartSeries, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaChartPoints } from "@/lib/fixtures/nvda";

/** Portfolio overview benchmark fetch must still work in single-asset demo mode. */
const BENCHMARK_CHART_TICKERS = new Set(["SPY", "QQQ", "DIA", "IWM", "VTI"]);

/** TEMP: raw 1D chart API diagnostics for AAPL/NVDA (remove after debugging). */
const CHART_API_DEBUG_TICKERS = new Set(["AAPL", "NVDA"]);

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
  const range: StockChartRange = isStockChartRange(rangeParam) ? rangeParam : "1D";
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

  const cadenceDaily = url.searchParams.get("cadence") === "daily";
  const loadChartPoints = cadenceDaily ? getSuperinvestorHoldingStockChartPoints : getStockChartPointsForApi;
  const rawPoints = await loadChartPoints(routeTicker, range, series);
  const points = sliceStockChartPointsForRange(rawPoints, range);
  const now = new Date();
  const liveSessionMinute = range === "1D" && !cadenceDaily && isStock1DLiveSessionMinuteChart(routeTicker, now);
  const livePostMarketChart = usesStock1DLiveWsPostMarketChart(routeTicker, now);
  const priorSession1D =
    range === "1D" &&
    !cadenceDaily &&
    !usesStock1DLiveWsMinutePipeline(routeTicker, now) &&
    !livePostMarketChart;
  let cacheControl =
    (usesStock1DLiveWsMinutePipeline(routeTicker, now) || livePostMarketChart) && liveSessionMinute
      ? CACHE_CONTROL_PRIVATE_NO_STORE
    : priorSession1D
      ? CACHE_CONTROL_PRIVATE_SUPERINVESTOR_HOLDING_CHART
      : cadenceDaily
        ? CACHE_CONTROL_PRIVATE_SUPERINVESTOR_HOLDING_CHART
        : CACHE_CONTROL_PRIVATE_CHART_STREAM;

  // TEMP DEBUG: AAPL/NVDA 1D during closed/pre-market — force no-store + surface raw API state
  // to isolate HTTP/browser/CDN cache from server session-selection. Remove after debugging.
  const debugTicker =
    CHART_API_DEBUG_TICKERS.has(routeUpper) && range === "1D" && !cadenceDaily;
  const closedOrPreMarket =
    !usesStock1DLiveWsMinutePipeline(routeTicker, now) && !livePostMarketChart;

  if (debugTicker && closedOrPreMarket) {
    cacheControl = CACHE_CONTROL_PRIVATE_NO_STORE;
  }

  let debug: Record<string, unknown> | undefined;
  if (debugTicker) {
    const first = points[0];
    const last = points[points.length - 1];
    const iso = (t: number | undefined) =>
      typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toISOString() : null;
    const branch = usesStock1DLiveWsMinutePipeline(routeTicker, now)
      ? "ws-regular-uncached"
      : livePostMarketChart
        ? "ws-postmarket-uncached"
        : "prior-session-cache";
    debug = {
      session: closedOrPreMarket ? "closed-or-pre" : "live",
      branch,
      sessionYmd: first?.sessionDate ?? null,
      firstPointTime: iso(first?.time),
      lastPointTime: iso(last?.time),
      pointCount: points.length,
      cacheControl,
      note:
        "source/interval/unstable_cache hit-miss printed server-side: a '[closed-1d]' log = cache MISS (fresh compute); only '[closed-1d api]' = cache HIT.",
    };
    console.info("[chart-api-raw]", routeUpper, debug);
  }

  return NextResponse.json(
    {
      ticker: routeTicker,
      range,
      series,
      points,
      liveSessionMinute,
      ...(debug ? { debug } : {}),
    },
    {
      headers: {
        "Cache-Control": cacheControl,
      },
    },
  );
}

