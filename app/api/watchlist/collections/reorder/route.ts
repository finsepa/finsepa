import { NextResponse } from "next/server";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  getWatchlistSnapshot,
  reorderWatchlistCollectionsOnServer,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("collectionIds" in body)) {
      return NextResponse.json({ error: "Missing collectionIds." }, { status: 400 });
    }

    const rawIds = (body as { collectionIds: unknown }).collectionIds;
    if (!Array.isArray(rawIds)) {
      return NextResponse.json({ error: "collectionIds must be an array." }, { status: 400 });
    }

    const collectionIds = rawIds.filter((id): id is string => typeof id === "string");
    await reorderWatchlistCollectionsOnServer(supabase, user.id, collectionIds);
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
