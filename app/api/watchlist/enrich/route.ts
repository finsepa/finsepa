import { NextResponse } from "next/server";

import { buildWatchlistEnrichedGroups } from "@/lib/market/watchlist-enrichment";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { syntheticWatchlistRows } from "@/lib/watchlist/synthetic";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const DEBUG = process.env.NODE_ENV === "development" || process.env.DEBUG_WATCHLIST === "1";

/**
 * POST body: { tickers: string[] } — built from client `useWatchlist` (localStorage ∪ Supabase).
 * Single read path for /watchlist table metrics; does not depend on Supabase containing rows.
 */
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

    const raw = body && typeof body === "object" && body !== null && "tickers" in body ? (body as { tickers: unknown }).tickers : null;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "Expected { tickers: string[] }" }, { status: 400 });
    }

    const tickers = raw.filter((t): t is string => typeof t === "string");
    if (DEBUG) {
      console.info("[watchlist enrich] load", { source: "POST body", count: tickers.length, tickers: tickers.slice(0, 20) });
    }

    const rows = syntheticWatchlistRows(tickers);
    const { stocks, crypto, indices } = await buildWatchlistEnrichedGroups(rows);

    if (DEBUG) {
      console.info("[watchlist enrich] result", {
        stocks: stocks.length,
        crypto: crypto.length,
        indices: indices.length,
      });
    }

    return NextResponse.json({ stocks, crypto, indices, source: "client-tickers" as const });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      if (DEBUG) console.info("[watchlist enrich] auth failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[watchlist enrich] error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
