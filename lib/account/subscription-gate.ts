import type { SupabaseClient } from "@supabase/supabase-js";

import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import {
  effectivePlatformTrialEndsAtIso,
  isPlatformTrialPast,
  platformTrialDaysRemaining,
} from "@/lib/account/platform-trial";

type BillingGateRow = {
  plan_code: string | null;
  status: string | null;
  platform_trial_ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Decides whether the user may use the main app shell, and optional top-bar trial countdown.
 * Uses DB fields (Stripe webhooks keep these aligned for paid access).
 */
export async function getSubscriptionGateContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ needsPaywall: boolean; topbarTrialDaysLeft: number | null }> {
  const { data: row } = await supabase
    .from("billing_subscriptions")
    .select("plan_code,status,platform_trial_ends_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle<BillingGateRow>();

  if (hasActivePaidProSubscription(row)) {
    return { needsPaywall: false, topbarTrialDaysLeft: null };
  }

  const planCode = row?.plan_code ?? "";
  const isStaleProRow = planCode.startsWith("pro_") && !hasActivePaidProSubscription(row);
  if (isStaleProRow) {
    return { needsPaywall: true, topbarTrialDaysLeft: null };
  }

  const platformEnd = effectivePlatformTrialEndsAtIso(row);
  if (!platformEnd) {
    return { needsPaywall: false, topbarTrialDaysLeft: null };
  }

  if (isPlatformTrialPast(platformEnd)) {
    return { needsPaywall: true, topbarTrialDaysLeft: null };
  }

  return {
    needsPaywall: false,
    topbarTrialDaysLeft: platformTrialDaysRemaining(platformEnd),
  };
}
