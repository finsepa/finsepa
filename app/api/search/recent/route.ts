import { NextResponse } from "next/server";

import {
  getUserRecentSearches,
  upsertUserRecentSearches,
} from "@/lib/search/recent-searches-server";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
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
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
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
