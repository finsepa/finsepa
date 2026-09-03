/**
 * Daily benchmark (SPY) closes for portfolio chart contribution overlays.
 * Uses the shared Portfolio EOD loader — full daily bars, not weekly/monthly stock-chart thinning.
 * Optional `intraday=1h` merges ~1h session bars into the visible month (1M overlay).
 */
import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { mergeEodWithIntradayBenchmarkPoints } from "@/lib/portfolio/benchmark/benchmark-chart-points";
import { loadPortfolioBenchmarkEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 1h lookback for 1M overlays — do not pull native 1m stock 1M. */
const BENCHMARK_HOURLY_MAX_SEC = 40 * 86400;
const BENCHMARK_HOURLY_PAD_SEC = 14 * 86400;

function parseYmdToUnixSeconds(ymd: string): number {
  return Math.floor(Date.parse(`${ymd}T16:00:00.000Z`) / 1000);
}

export async function GET(request: Request) {
  try {
    await requireAuthUserFromRequest(request);

    const url = new URL(request.url);
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const tickerRaw = url.searchParams.get("ticker")?.trim().toUpperCase() || "SPY";
    const ticker = tickerRaw.replace(/[^A-Z0-9.-]/g, "").slice(0, 12) || "SPY";
    const wantHourly = url.searchParams.get("intraday") === "1h";

    if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) {
      return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
    }

    const bars = await loadPortfolioBenchmarkEodBars(ticker, from, to, { retry: true });
    const eod: StockChartPoint[] = bars.map((b) => ({
      time: parseYmdToUnixSeconds(b.date),
      value: b.close,
      sessionDate: b.date,
    }));

    let points = eod;
    if (wantHourly) {
      const nowSec = Math.floor(Date.now() / 1000);
      const rangeFromSec = Math.floor(Date.parse(`${from}T00:00:00.000Z`) / 1000);
      const hourlyFrom = Math.max(rangeFromSec, nowSec - BENCHMARK_HOURLY_MAX_SEC) - BENCHMARK_HOURLY_PAD_SEC;
      const hourlyBars = await fetchEodhdIntraday(ticker, hourlyFrom, nowSec, "1h");
      if (hourlyBars?.length) {
        const intra: StockChartPoint[] = hourlyBars
          .filter((b) => Number.isFinite(b.timestamp) && Number.isFinite(b.close) && b.close > 0)
          .map((b) => ({
            time: b.timestamp,
            value: b.close,
            sessionDate: usSessionYmdFromUnixSeconds(b.timestamp),
          }));
        if (intra.length > 0) points = mergeEodWithIntradayBenchmarkPoints(eod, intra);
      }
    }

    return NextResponse.json(
      { ticker, from, to, points },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio benchmark-history]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
