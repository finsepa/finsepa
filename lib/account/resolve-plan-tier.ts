import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import {
  entitlementsForTier,
  needsHardPaywall,
  type PlanEntitlements,
  type PlanTier,
} from "@/lib/account/plan-entitlements";

export type SubscriptionGateRow = {
  plan_code?: string | null;
  status?: string | null;
  platform_trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Resolve product tier from billing_subscriptions row.
 * - Pro: active/trialing paid Stripe (or Apple) plan
 * - Free: everyone else (new signups, canceled Pro after period, missing row)
 * Platform 7-day trial is retired; `trial` remains in PlanTier for API compatibility only.
 */
export function resolvePlanTier(row: SubscriptionGateRow | null | undefined): PlanTier {
  if (hasActivePaidProSubscription(row)) return "pro";
  return "free";
}

export function planEntitlementsFromBillingRow(
  row: SubscriptionGateRow | null | undefined,
): PlanEntitlements {
  return entitlementsForTier(resolvePlanTier(row), null);
}

export type SubscriptionGateContext = PlanEntitlements & {
  /**
   * @deprecated Hard paywall removed; always false. Kept for call-site compatibility.
   */
  needsPaywall: boolean;
};

export function subscriptionGateFromBillingRow(
  row: SubscriptionGateRow | null | undefined,
): SubscriptionGateContext {
  const entitlements = planEntitlementsFromBillingRow(row);
  return {
    ...entitlements,
    needsPaywall: needsHardPaywall(entitlements.tier),
  };
}
