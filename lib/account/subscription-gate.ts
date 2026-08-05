import type { SupabaseClient } from "@supabase/supabase-js";

import {
  subscriptionGateFromBillingRow,
  type SubscriptionGateContext,
} from "@/lib/account/resolve-plan-tier";

/**
 * Decides product tier + entitlements for the authenticated user.
 * Expired trial / canceled Pro → Free (full app access with Free limits).
 * Hard paywall is not used.
 */
export async function getSubscriptionGateContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionGateContext> {
  const { data: row } = await supabase
    .from("billing_subscriptions")
    .select("plan_code,status,platform_trial_ends_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return subscriptionGateFromBillingRow(row);
}
