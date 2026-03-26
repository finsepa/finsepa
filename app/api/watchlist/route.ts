import { NextResponse } from "next/server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  addWatchlistTicker,
  listWatchlistForUser,
  normalizeWatchlistTicker,
  removeWatchlistTicker,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    const items = await listWatchlistForUser(supabase, user.id);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("ticker" in body)) {
      return NextResponse.json({ error: "Missing ticker." }, { status: 400 });
    }

    const raw = (body as { ticker: unknown }).ticker;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "ticker must be a string." }, { status: 400 });
    }

    const ticker = normalizeWatchlistTicker(raw);
    const { row, created } = await addWatchlistTicker(supabase, user.id, ticker);
    return NextResponse.json({ entry: row, created }, { status: 200 });
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

export async function DELETE(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const tickerParam = new URL(request.url).searchParams.get("ticker");
    if (tickerParam == null || tickerParam === "") {
      return NextResponse.json({ error: "Missing ticker query parameter." }, { status: 400 });
    }

    const ticker = normalizeWatchlistTicker(tickerParam);
    const { removed } = await removeWatchlistTicker(supabase, user.id, ticker);
    return NextResponse.json({ removed }, { status: 200 });
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
