import { NextResponse } from "next/server";

import { buildWatchlistEnrichedGroups } from "@/lib/market/watchlist-enrichment";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { listWatchlistForUser } from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const DEBUG = process.env.NODE_ENV === "development" || process.env.DEBUG_WATCHLIST === "1";

/** Legacy GET: enriches DB-backed rows. Prefer POST /api/watchlist/enrich with client tickers. */
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    let items: Awaited<ReturnType<typeof listWatchlistForUser>> = [];
    try {
      items = await listWatchlistForUser(supabase, user.id);
    } catch (dbErr) {
      console.error("[watchlist enriched GET] listWatchlistForUser failed", dbErr);
      if (DEBUG) {
        console.info("[watchlist enriched GET] returning empty; client should use POST /enrich with tickers");
      }
      return NextResponse.json({
        stocks: [],
        crypto: [],
        indices: [],
        source: "db-error-empty" as const,
        warning: "db_unavailable",
      });
    }
    if (DEBUG) {
      console.info("[watchlist enriched GET] db rows", { count: items.length });
    }
    const { stocks, crypto, indices } = await buildWatchlistEnrichedGroups(items);
    return NextResponse.json({ stocks, crypto, indices, source: "supabase" as const });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[watchlist enriched GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
