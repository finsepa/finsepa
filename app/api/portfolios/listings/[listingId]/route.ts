import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { parsePublicListingSnapshotFromMetrics } from "@/lib/portfolio/public-listing-snapshot";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteCtx = { params: Promise<{ listingId: string }> };

/** Single community listing with read-only snapshot for `/portfolios/[listingId]`. */
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
      .select("id, display_name, metrics, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[portfolios/listings GET one]", error.message);
      return NextResponse.json({ error: "Could not load portfolio." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }

    const metrics = (data.metrics ?? {}) as Record<string, unknown>;
    const snapshot = parsePublicListingSnapshotFromMetrics(metrics);

    return NextResponse.json({
      id: data.id as string,
      name: data.display_name as string,
      metrics,
      snapshot,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
