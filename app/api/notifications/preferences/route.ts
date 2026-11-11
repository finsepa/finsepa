import { NextResponse } from "next/server";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences-store";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

/** Activity alerts (Pro). Market alerts are free and never gated. */
const PRO_FIELDS = [
  "earningsResultsEnabled",
  "superinvestorActivityEnabled",
  "slidesEnabled",
  "reportsEnabled",
] as const satisfies readonly (keyof NotificationPreferences)[];

const FREE_FIELDS = [
  "marketHighLowEnabled",
  "priceAlertsEnabled",
] as const satisfies readonly (keyof NotificationPreferences)[];

function jsonPreferences(preferences: NotificationPreferences, canUseActivityAlerts: boolean) {
  return {
    earningsResultsEnabled: canUseActivityAlerts && preferences.earningsResultsEnabled,
    superinvestorActivityEnabled:
      canUseActivityAlerts && preferences.superinvestorActivityEnabled,
    slidesEnabled: canUseActivityAlerts && preferences.slidesEnabled,
    reportsEnabled: canUseActivityAlerts && preferences.reportsEnabled,
    marketHighLowEnabled: preferences.marketHighLowEnabled,
    priceAlertsEnabled: preferences.priceAlertsEnabled,
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
    const body = (await request.json()) as Record<string, unknown>;

    const patch: Partial<NotificationPreferences> = {};
    for (const field of [...PRO_FIELDS, ...FREE_FIELDS]) {
      if (typeof body[field] === "boolean") patch[field] = body[field];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: `Provide any of: ${[...PRO_FIELDS, ...FREE_FIELDS].join(", ")}` },
        { status: 400 },
      );
    }

    const gate = await getSubscriptionGateContext(supabase, user.id);
    const touchesPro = PRO_FIELDS.some((field) => field in patch);
    if (touchesPro && !gate.canUseActivityAlerts) {
      return NextResponse.json(
        {
          error: "Activity alerts are available on Pro. Upgrade to change notification preferences.",
          code: "ACTIVITY_ALERTS_PRO_REQUIRED",
        },
        { status: 403 },
      );
    }

    const preferences = await updateNotificationPreferences(supabase, user.id, patch);
    return NextResponse.json(jsonPreferences(preferences, gate.canUseActivityAlerts));
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
