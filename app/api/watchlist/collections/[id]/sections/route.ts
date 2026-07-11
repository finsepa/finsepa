import { NextResponse } from "next/server";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  getWatchlistSnapshot,
  updateWatchlistCollectionSectionsLayoutOnServer,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { normalizeTickerSections, normalizeWatchlistSections } from "@/lib/watchlist/sections";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseServerClient();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }

    const sections = normalizeWatchlistSections((body as { sections?: unknown }).sections);
    const tickerSections = normalizeTickerSections(
      (body as { tickerSections?: unknown }).tickerSections,
      sections,
    );

    await updateWatchlistCollectionSectionsLayoutOnServer(supabase, user.id, id, {
      sections,
      tickerSections,
    });
    const snapshot = await getWatchlistSnapshot(supabase, user.id);
    return NextResponse.json(snapshot, { status: 200 });
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
