import { NextResponse } from "next/server";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import {
  getNotificationPreferences,
  setEarningsResultsEnabled,
  setReportsEnabled,
  setSlidesEnabled,
  setSuperinvestorActivityEnabled,
} from "@/lib/notifications/notification-preferences-store";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

function jsonPreferences(
  preferences: Awaited<ReturnType<typeof getNotificationPreferences>>,
  canUseActivityAlerts: boolean,
) {
  return {
    earningsResultsEnabled: canUseActivityAlerts && preferences.earningsResultsEnabled,
    superinvestorActivityEnabled:
      canUseActivityAlerts && preferences.superinvestorActivityEnabled,
    slidesEnabled: canUseActivityAlerts && preferences.slidesEnabled,
    reportsEnabled: canUseActivityAlerts && preferences.reportsEnabled,
    canUseActivityAlerts,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const [preferences, gate] = await Promise.all([
      getNotificationPreferences(supabase, user.id),
      getSubscriptionGateContext(supabase, user.id),
    ]);
    return NextResponse.json(jsonPreferences(preferences, gate.canUseActivityAlerts));
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
      slidesEnabled?: unknown;
      reportsEnabled?: unknown;
    };

    const hasEarnings = typeof body.earningsResultsEnabled === "boolean";
    const hasSuperinvestor = typeof body.superinvestorActivityEnabled === "boolean";
    const hasSlides = typeof body.slidesEnabled === "boolean";
    const hasReports = typeof body.reportsEnabled === "boolean";
    if (!hasEarnings && !hasSuperinvestor && !hasSlides && !hasReports) {
      return NextResponse.json(
        {
          error:
            "Provide earningsResultsEnabled, superinvestorActivityEnabled, slidesEnabled, and/or reportsEnabled",
        },
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
    if (hasSlides) {
      preferences = await setSlidesEnabled(supabase, user.id, body.slidesEnabled as boolean);
    }
    if (hasReports) {
      preferences = await setReportsEnabled(supabase, user.id, body.reportsEnabled as boolean);
    }

    return NextResponse.json(jsonPreferences(preferences, true));
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
