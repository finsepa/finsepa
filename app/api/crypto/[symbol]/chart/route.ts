import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCryptoChartPoints } from "@/lib/market/crypto-chart-data";
import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

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

  /** Windowing is already applied inside {@link getCryptoChartPoints}; avoid a second slice that can drop the whole series. */
  const points = await getCryptoChartPoints(routeSymbol, range);

  return NextResponse.json({
    symbol: routeSymbol,
    range,
    points,
  });
}
