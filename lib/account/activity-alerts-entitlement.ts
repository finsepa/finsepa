import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { subscriptionGateFromBillingRow } from "@/lib/account/resolve-plan-tier";

/**
 * Among {@link userIds}, returns those entitled to activity alerts (Pro).
 * Missing billing row ⇒ Free ⇒ not eligible.
 *
 * Used by notification fan-out so Free users never get new inbox rows even if prefs stay on.
 */
export async function filterUserIdsWithActivityAlerts(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds.filter((id) => typeof id === "string" && id.trim()))];
  if (unique.length === 0) return new Set();

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("user_id,plan_code,status,platform_trial_ends_at,created_at,updated_at")
    .in("user_id", unique);

  if (error) throw new Error(error.message);

  const byUser = new Map<
    string,
    {
      plan_code?: string | null;
      status?: string | null;
      platform_trial_ends_at?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    }
  >();
  for (const row of data ?? []) {
    const id = typeof row.user_id === "string" ? row.user_id : "";
    if (id) byUser.set(id, row);
  }

  const eligible = new Set<string>();
  for (const userId of unique) {
    const gate = subscriptionGateFromBillingRow(byUser.get(userId) ?? null);
    if (gate.canUseActivityAlerts) eligible.add(userId);
  }
  return eligible;
}
