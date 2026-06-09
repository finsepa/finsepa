import { NextResponse } from "next/server";

import { toClientNotificationItem } from "@/lib/notifications/notification-api-map";
import {
  countUnreadNotifications,
  deleteAllNotifications,
  listUserNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications/user-notifications-store";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("count") === "1";

    if (countOnly) {
      const unread = await countUnreadNotifications(supabase, user.id);
      return NextResponse.json({ unread });
    }

    const [items, unread] = await Promise.all([
      listUserNotifications(supabase, user.id),
      countUnreadNotifications(supabase, user.id),
    ]);

    return NextResponse.json({
      items: items.map(toClientNotificationItem),
      unread,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    await markAllNotificationsRead(supabase, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);
    await deleteAllNotifications(supabase, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
