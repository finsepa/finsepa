import { NextResponse } from "next/server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  getWatchlistSnapshot,
  setActiveWatchlistCollectionOnServer,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("collectionId" in body)) {
      return NextResponse.json({ error: "Missing collectionId." }, { status: 400 });
    }

    const rawId = (body as { collectionId: unknown }).collectionId;
    if (typeof rawId !== "string" || !rawId.trim()) {
      return NextResponse.json({ error: "collectionId must be a non-empty string." }, { status: 400 });
    }

    await setActiveWatchlistCollectionOnServer(supabase, user.id, rawId.trim());
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
