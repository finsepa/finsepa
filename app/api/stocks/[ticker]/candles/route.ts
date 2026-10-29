import { NextResponse } from "next/server";

import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import {
  CACHE_CONTROL_PRIVATE_HOT,
  CACHE_CONTROL_PRIVATE_NO_STORE,
  CACHE_CONTROL_PRIVATE_WARM,
} from "@/lib/data/cache-policy";
import { isStockChartRange } from "@/lib/market/stock-chart-api";
import { loadStockCandles } from "@/lib/market/stock-candles";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

type Ctx = { params: Promise<{ ticker: string }> };

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,19}$/;

/** GET `?range=` — OHLC candles for the stock overview chart's candle mode. */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticker = decodeURIComponent((await params).ticker).trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const rangeParam = new URL(request.url).searchParams.get("range");
  const range: StockChartRange = isStockChartRange(rangeParam) ? rangeParam : "1D";

  const payload = await loadStockCandles(ticker, range);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": payload.live
        ? CACHE_CONTROL_PRIVATE_NO_STORE
        : range === "1D" || range === "5D"
          ? CACHE_CONTROL_PRIVATE_HOT
          : CACHE_CONTROL_PRIVATE_WARM,
    },
  });
}
