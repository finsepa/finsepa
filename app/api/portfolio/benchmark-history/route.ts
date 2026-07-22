/**
 * Daily benchmark (SPY) closes for portfolio chart contribution overlays.
 * Uses the shared Portfolio EOD loader — full daily bars, not weekly/monthly stock-chart thinning.
 */
import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { loadPortfolioBenchmarkEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmdToUnixSeconds(ymd: string): number {
  return Math.floor(Date.parse(`${ymd}T16:00:00.000Z`) / 1000);
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    const url = new URL(request.url);
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const tickerRaw = url.searchParams.get("ticker")?.trim().toUpperCase() || "SPY";
    const ticker = tickerRaw.replace(/[^A-Z0-9.-]/g, "").slice(0, 12) || "SPY";

    if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) {
      return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
    }

    const bars = await loadPortfolioBenchmarkEodBars(ticker, from, to, { retry: true });
    const points = bars.map((b) => ({
      time: parseYmdToUnixSeconds(b.date),
      value: b.close,
      sessionDate: b.date,
    }));

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
