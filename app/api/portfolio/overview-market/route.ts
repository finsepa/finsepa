import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_OVERVIEW_MARKET } from "@/lib/data/cache-policy";
import { getPortfolioOverviewMarketPayload } from "@/lib/portfolio/portfolio-overview-market-server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  symbols?: unknown;
  inceptionYmd?: unknown;
  inceptionPriceTickers?: unknown;
};

/**
 * Single round-trip for portfolio overview: performance + dividend yields + inception open prices.
 * Fundamentals fetched once per symbol (yield); cached 60s per symbol set.
 */
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawSyms = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === "string") : [];
    const symbols = [...new Set(rawSyms.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0))];

    const inceptionYmd =
      typeof body.inceptionYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.inceptionYmd)
        ? body.inceptionYmd
        : null;

    const rawPriceTk =
      Array.isArray(body.inceptionPriceTickers) ?
        body.inceptionPriceTickers.filter((s): s is string => typeof s === "string")
      : [];
    const inceptionPriceTickers = [
      ...new Set(rawPriceTk.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)),
    ];

    const payload = await getPortfolioOverviewMarketPayload(symbols, inceptionYmd, inceptionPriceTickers);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": CACHE_CONTROL_PRIVATE_OVERVIEW_MARKET,
      },
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio overview-market]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
