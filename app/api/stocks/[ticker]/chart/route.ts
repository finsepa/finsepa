import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockChartPoints } from "@/lib/market/stock-chart-data";
import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

function isRange(v: string | null): v is StockChartRange {
  return v != null && (STOCK_CHART_RANGES as readonly string[]).includes(v);
}

function rangeStartUnixSeconds(range: StockChartRange, now: Date): number | null {
  const nowSec = Math.floor(now.getTime() / 1000);
  if (range === "1D") return nowSec - 1 * 24 * 60 * 60;
  if (range === "5D") return nowSec - 5 * 24 * 60 * 60;
  if (range === "1M") return nowSec - 30 * 24 * 60 * 60;
  if (range === "6M") return nowSec - 183 * 24 * 60 * 60;
  if (range === "1Y") return nowSec - 365 * 24 * 60 * 60;
  if (range === "YTD") {
    const ytd = Date.UTC(now.getUTCFullYear(), 0, 1);
    return Math.floor(ytd / 1000);
  }
  return null; // ALL
}

function sliceFromNearestTradingPoint(points: Array<{ time: number; value: number }>, startSec: number | null) {
  if (startSec == null) return points;
  const idx = points.findIndex((p) => p.time >= startSec);
  return idx === -1 ? [] : points.slice(idx);
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

  const rawPoints = await getStockChartPoints(routeTicker, range);
  const startSec = rangeStartUnixSeconds(range, new Date());
  const points = sliceFromNearestTradingPoint(rawPoints, startSec);

  return NextResponse.json({
    ticker: routeTicker,
    range,
    points,
  });
}

