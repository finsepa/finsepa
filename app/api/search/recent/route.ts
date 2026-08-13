import { NextResponse } from "next/server";

import {
  getUserRecentSearchesSnapshot,
  upsertUserRecentSearches,
} from "@/lib/search/recent-searches-server";
import { AuthRequiredError, requireAuthUserFromRequest } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

/** Auth: Bearer or cookie via `requireAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const snapshot = await getUserRecentSearchesSnapshot(supabase, user.id);
    return NextResponse.json({
      items: snapshot.items,
      clearedAt: snapshot.clearedAt,
      updatedAt: snapshot.updatedAt,
      removed: snapshot.removed,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const body = (await request.json()) as {
      items?: unknown;
      removedIds?: unknown;
      clear?: unknown;
    };
    const removedIds = Array.isArray(body.removedIds)
      ? body.removedIds.filter((id): id is string => typeof id === "string")
      : [];
    const clear = body.clear === true;
    const items = await upsertUserRecentSearches(
      supabase,
      user.id,
      body.items,
      removedIds,
      { clear },
    );
    return NextResponse.json({ items, cleared: clear || items.length === 0 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
