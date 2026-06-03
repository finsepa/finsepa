import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_DIVIDENDS_SCHEDULE } from "@/lib/data/cache-policy";
import { buildPortfolioDividendsSchedule } from "@/lib/portfolio/portfolio-dividends-schedule-server";
import { parsePublicListingSnapshotFromMetrics } from "@/lib/portfolio/public-listing-snapshot";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteCtx = { params: Promise<{ listingId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const { listingId } = await ctx.params;
    const id = listingId?.trim();
    if (!id) {
      return NextResponse.json({ error: "listingId is required." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    const { data, error } = await supabase
      .from("public_portfolio_listings")
      .select("metrics")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[portfolios/listings dividends-schedule]", error.message);
      return NextResponse.json({ error: "Could not load portfolio." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }

    const snapshot = parsePublicListingSnapshotFromMetrics((data.metrics ?? {}) as Record<string, unknown>);
    const holdings =
      snapshot?.holdings?.map((h) => ({ symbol: h.symbol, shares: h.shares })) ?? [];

    const payload = await buildPortfolioDividendsSchedule(holdings);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_DIVIDENDS_SCHEDULE },
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolios/listings dividends-schedule]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
