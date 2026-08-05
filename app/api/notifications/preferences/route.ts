import { NextResponse } from "next/server";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
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
    const [preferences, gate] = await Promise.all([
      getNotificationPreferences(supabase, user.id),
      getSubscriptionGateContext(supabase, user.id),
    ]);
    const canUseActivityAlerts = gate.canUseActivityAlerts;
    // Effective: Free always sees/receives off even if DB preference is still on after cancel.
    return NextResponse.json({
      earningsResultsEnabled: canUseActivityAlerts && preferences.earningsResultsEnabled,
      canUseActivityAlerts,
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
    const gate = await getSubscriptionGateContext(supabase, user.id);
    if (!gate.canUseActivityAlerts) {
      return NextResponse.json(
        {
          error: "Activity alerts are available on Pro. Upgrade to change notification preferences.",
          code: "ACTIVITY_ALERTS_PRO_REQUIRED",
        },
        { status: 403 },
      );
    }

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
      canUseActivityAlerts: true,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
