import { NextResponse } from "next/server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  addWatchlistTicker,
  getWatchlistSnapshot,
  normalizeWatchlistTicker,
  removeWatchlistTicker,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    try {
      const snapshot = await getWatchlistSnapshot(supabase, user.id);
      return NextResponse.json(snapshot);
    } catch (dbErr) {
      console.error("[watchlist GET] getWatchlistSnapshot failed", dbErr);
      return NextResponse.json({ collections: [], activeCollectionId: "", warning: "db_unavailable" as const });
    }
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let authenticatedUserId: string | undefined;
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    authenticatedUserId = user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("ticker" in body) || !("collectionId" in body)) {
      return NextResponse.json({ error: "Missing ticker or collectionId." }, { status: 400 });
    }

    const rawTicker = (body as { ticker: unknown }).ticker;
    const rawCollectionId = (body as { collectionId: unknown }).collectionId;
    if (typeof rawTicker !== "string" || typeof rawCollectionId !== "string") {
      return NextResponse.json({ error: "ticker and collectionId must be strings." }, { status: 400 });
    }

    const ticker = normalizeWatchlistTicker(rawTicker);
    const collectionId = rawCollectionId.trim();
    if (!collectionId) {
      return NextResponse.json({ error: "collectionId is required." }, { status: 400 });
    }

    const { row, created } = await addWatchlistTicker(supabase, user.id, collectionId, ticker);
    return NextResponse.json({ entry: row, created }, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[watchlist POST] failed", { authenticatedUserId, message, err: e });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const params = new URL(request.url).searchParams;
    const tickerParam = params.get("ticker");
    if (tickerParam == null || tickerParam === "") {
      return NextResponse.json({ error: "Missing ticker query parameter." }, { status: 400 });
    }

    const ticker = normalizeWatchlistTicker(tickerParam);
    const scope = params.get("scope");
    const collectionId = params.get("collectionId")?.trim() || undefined;

    const { removed } = await removeWatchlistTicker(
      supabase,
      user.id,
      ticker,
      scope === "all" ? undefined : collectionId,
    );

    if (!removed) {
      return NextResponse.json(
        { error: "Watchlist entry not found for this ticker.", ticker, removed: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
