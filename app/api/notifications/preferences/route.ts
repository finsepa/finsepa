import { NextResponse } from "next/server";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import {
  getNotificationPreferences,
  setEarningsResultsEnabled,
  setSuperinvestorActivityEnabled,
} from "@/lib/notifications/notification-preferences-store";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const [preferences, gate] = await Promise.all([
      getNotificationPreferences(supabase, user.id),
      getSubscriptionGateContext(supabase, user.id),
    ]);
    const canUseActivityAlerts = gate.canUseActivityAlerts;
    // Effective: Free always sees/receives off even if DB preference is still on after cancel.
    return NextResponse.json({
      earningsResultsEnabled: canUseActivityAlerts && preferences.earningsResultsEnabled,
      superinvestorActivityEnabled:
        canUseActivityAlerts && preferences.superinvestorActivityEnabled,
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
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
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

    const body = (await request.json()) as {
      earningsResultsEnabled?: unknown;
      superinvestorActivityEnabled?: unknown;
    };

    const hasEarnings = typeof body.earningsResultsEnabled === "boolean";
    const hasSuperinvestor = typeof body.superinvestorActivityEnabled === "boolean";
    if (!hasEarnings && !hasSuperinvestor) {
      return NextResponse.json(
        { error: "Provide earningsResultsEnabled and/or superinvestorActivityEnabled" },
        { status: 400 },
      );
    }

    let preferences = await getNotificationPreferences(supabase, user.id);
    if (hasEarnings) {
      preferences = await setEarningsResultsEnabled(
        supabase,
        user.id,
        body.earningsResultsEnabled as boolean,
      );
    }
    if (hasSuperinvestor) {
      preferences = await setSuperinvestorActivityEnabled(
        supabase,
        user.id,
        body.superinvestorActivityEnabled as boolean,
      );
    }

    return NextResponse.json({
      earningsResultsEnabled: preferences.earningsResultsEnabled,
      superinvestorActivityEnabled: preferences.superinvestorActivityEnabled,
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
