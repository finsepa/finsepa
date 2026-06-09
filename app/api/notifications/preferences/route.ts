import { NextResponse } from "next/server";

import {
  getNotificationPreferences,
  setEarningsResultsEnabled,
} from "@/lib/notifications/notification-preferences-store";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    const preferences = await getNotificationPreferences(supabase, user.id);
    return NextResponse.json({
      earningsResultsEnabled: preferences.earningsResultsEnabled,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    const body = (await request.json()) as { earningsResultsEnabled?: unknown };
    if (typeof body.earningsResultsEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid earningsResultsEnabled" }, { status: 400 });
    }
    const preferences = await setEarningsResultsEnabled(
      supabase,
      user.id,
      body.earningsResultsEnabled,
    );
    return NextResponse.json({
      earningsResultsEnabled: preferences.earningsResultsEnabled,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
