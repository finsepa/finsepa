import type { SupabaseClient } from "@supabase/supabase-js";

import {
  subscriptionGateFromBillingRow,
  type SubscriptionGateContext,
} from "@/lib/account/resolve-plan-tier";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BILLING_GATE_SELECT =
  "plan_code,status,platform_trial_ends_at,created_at,updated_at" as const;

/**
 * Decides product tier + entitlements for the authenticated user.
 * Expired trial / canceled Pro → Free (full app access with Free limits).
 * Hard paywall is not used.
 *
 * When the user-scoped SELECT returns no row (session/RLS glitch, transient Auth
 * cookie issue after multi-device use), re-check with the service role so an active
 * Pro subscriber is never shown the false “trial ended” Free-limits modal.
 */
export async function getSubscriptionGateContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionGateContext> {
  const { data: row, error } = await supabase
    .from("billing_subscriptions")
    .select(BILLING_GATE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (row) {
    return subscriptionGateFromBillingRow(row);
  }

  if (error) {
    console.warn("[subscription-gate] billing select failed", error.message);
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: adminRow, error: adminError } = await admin
      .from("billing_subscriptions")
      .select(BILLING_GATE_SELECT)
      .eq("user_id", userId)
      .maybeSingle();
    if (adminError) {
      console.warn("[subscription-gate] admin billing select failed", adminError.message);
    }
    if (adminRow) {
      return subscriptionGateFromBillingRow(adminRow);
    }
  }

  return subscriptionGateFromBillingRow(null);
}
