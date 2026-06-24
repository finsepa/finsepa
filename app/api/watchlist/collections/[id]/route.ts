import { NextResponse } from "next/server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  deleteWatchlistCollectionOnServer,
  getWatchlistSnapshot,
  renameWatchlistCollectionOnServer,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("name" in body)) {
      return NextResponse.json({ error: "Missing name." }, { status: 400 });
    }

    const rawName = (body as { name: unknown }).name;
    if (typeof rawName !== "string") {
      return NextResponse.json({ error: "name must be a string." }, { status: 400 });
    }

    await renameWatchlistCollectionOnServer(supabase, user.id, id, rawName);
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    const { id } = await context.params;

    await deleteWatchlistCollectionOnServer(supabase, user.id, id);
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
