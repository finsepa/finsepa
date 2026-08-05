import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  computePortfolioValueHistory,
  parsePortfolioValueHistoryBody,
} from "@/lib/portfolio/portfolio-value-history.server";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parsePortfolioValueHistoryBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Do not use unstable_cache here: it previously closed over request txs and could
    // serve empty results for 5 minutes after a transient provider miss.
    const points = await computePortfolioValueHistory(parsed.range, parsed.transactions);

    return NextResponse.json(
      { points },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_PRIVATE_WARM,
        },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio value-history]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
