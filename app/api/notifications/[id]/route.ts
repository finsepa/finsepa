import { NextResponse } from "next/server";

import { deleteNotification } from "@/lib/notifications/user-notifications-store";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    await deleteNotification(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
