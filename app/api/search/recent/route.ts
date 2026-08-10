import { NextResponse } from "next/server";

import {
  getUserRecentSearches,
  upsertUserRecentSearches,
} from "@/lib/search/recent-searches-server";
import { AuthRequiredError, requireAuthUserFromRequest } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

/** Auth: Bearer or cookie via `requireAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const items = await getUserRecentSearches(supabase, user.id);
    return NextResponse.json({ items });
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
    const body = (await request.json()) as { items?: unknown; removedIds?: unknown };
    const removedIds = Array.isArray(body.removedIds)
      ? body.removedIds.filter((id): id is string => typeof id === "string")
      : [];
    const items = await upsertUserRecentSearches(supabase, user.id, body.items, removedIds);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
