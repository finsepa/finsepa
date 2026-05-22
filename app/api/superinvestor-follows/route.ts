import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";
import {
  addSuperinvestorFollow,
  listSuperinvestorFollowsForUser,
  normalizeSuperinvestorFollowPath,
  removeSuperinvestorFollow,
  SuperinvestorFollowValidationError,
} from "@/lib/superinvestors/follow-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    try {
      const items = await listSuperinvestorFollowsForUser(supabase, user.id);
      return NextResponse.json({ items });
    } catch (dbErr) {
      console.error("[superinvestor-follows GET] list failed", dbErr);
      return NextResponse.json({ items: [], warning: "db_unavailable" as const });
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
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("profilePath" in body)) {
      return NextResponse.json({ error: "Missing profilePath." }, { status: 400 });
    }

    const raw = (body as { profilePath: unknown }).profilePath;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "profilePath must be a string." }, { status: 400 });
    }

    const profilePath = normalizeSuperinvestorFollowPath(raw);
    const { row, created } = await addSuperinvestorFollow(supabase, user.id, profilePath);
    return NextResponse.json({ entry: row, created }, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof SuperinvestorFollowValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[superinvestor-follows POST] failed", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const profilePathParam = new URL(request.url).searchParams.get("profilePath");
    if (profilePathParam == null || profilePathParam === "") {
      return NextResponse.json({ error: "Missing profilePath query parameter." }, { status: 400 });
    }

    const profilePath = normalizeSuperinvestorFollowPath(profilePathParam);
    const { removed } = await removeSuperinvestorFollow(supabase, user.id, profilePath);
    if (!removed) {
      return NextResponse.json(
        { error: "Follow not found for this profile.", profilePath, removed: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof SuperinvestorFollowValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
