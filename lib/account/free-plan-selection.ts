import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EMPTY_FREE_PLAN_SELECTION,
  type FreePlanSelectionRow,
} from "@/lib/account/free-plan-selection-client";
import { isManualPortfolioForFreeQuota } from "@/lib/account/free-plan-quota";
import { parsePersistedPortfolioUnknown } from "@/lib/portfolio/portfolio-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type { FreePlanSelectionRow };
export { EMPTY_FREE_PLAN_SELECTION };

export async function loadFreePlanSelection(
  supabase: SupabaseClient,
  userId: string,
): Promise<FreePlanSelectionRow> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select(
      "free_active_portfolio_id, free_active_watchlist_id, free_portfolio_selection_locked, free_watchlist_selection_locked, free_plan_limits_acked_at",
    )
    .eq("user_id", userId)
    .maybeSingle<FreePlanSelectionRow>();

  if (error || !data) return EMPTY_FREE_PLAN_SELECTION;

  return {
    free_active_portfolio_id:
      typeof data.free_active_portfolio_id === "string" ? data.free_active_portfolio_id : null,
    free_active_watchlist_id:
      typeof data.free_active_watchlist_id === "string" ? data.free_active_watchlist_id : null,
    free_portfolio_selection_locked: data.free_portfolio_selection_locked === true,
    free_watchlist_selection_locked: data.free_watchlist_selection_locked === true,
    free_plan_limits_acked_at:
      typeof data.free_plan_limits_acked_at === "string" ? data.free_plan_limits_acked_at : null,
  };
}

/** True when Free active portfolio id still exists as a manual book in workspace. */
export async function freeActiveManualPortfolioExists(
  userId: string,
  portfolioId: string,
): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { data, error } = await admin
    .from("portfolio_workspace")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.state) return false;
  const state = parsePersistedPortfolioUnknown(data.state);
  if (!state) return false;
  const entry = state.portfolios.find((p) => p.id === portfolioId);
  return entry != null && isManualPortfolioForFreeQuota(entry);
}

export async function patchFreePlanSelection(
  _supabase: SupabaseClient,
  userId: string,
  patch: Partial<FreePlanSelectionRow>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // billing_subscriptions is SELECT-only for authenticated users; writes need service role.
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Billing store is temporarily unavailable." };
  }

  const { data: existingRow } = await admin
    .from("billing_subscriptions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingRow) {
    const trialEnds = new Date(Date.now() - 86_400_000).toISOString();
    const { error: insertErr } = await admin.from("billing_subscriptions").insert({
      user_id: userId,
      plan_code: "free",
      status: "free",
      platform_trial_ends_at: trialEnds,
      free_active_portfolio_id: patch.free_active_portfolio_id ?? null,
      free_active_watchlist_id: patch.free_active_watchlist_id ?? null,
      free_portfolio_selection_locked: patch.free_portfolio_selection_locked ?? false,
      free_watchlist_selection_locked: patch.free_watchlist_selection_locked ?? false,
      free_plan_limits_acked_at: patch.free_plan_limits_acked_at ?? null,
    });
    if (insertErr) return { ok: false, error: insertErr.message };
    return { ok: true };
  }

  const { error } = await admin
    .from("billing_subscriptions")
    .update({
      ...(patch.free_active_portfolio_id !== undefined
        ? { free_active_portfolio_id: patch.free_active_portfolio_id }
        : {}),
      ...(patch.free_active_watchlist_id !== undefined
        ? { free_active_watchlist_id: patch.free_active_watchlist_id }
        : {}),
      ...(patch.free_portfolio_selection_locked !== undefined
        ? { free_portfolio_selection_locked: patch.free_portfolio_selection_locked }
        : {}),
      ...(patch.free_watchlist_selection_locked !== undefined
        ? { free_watchlist_selection_locked: patch.free_watchlist_selection_locked }
        : {}),
      ...(patch.free_plan_limits_acked_at !== undefined
        ? { free_plan_limits_acked_at: patch.free_plan_limits_acked_at }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
