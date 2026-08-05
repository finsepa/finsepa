import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import {
  entitlementsForTier,
  needsHardPaywall,
  type PlanEntitlements,
  type PlanTier,
} from "@/lib/account/plan-entitlements";
import {
  effectivePlatformTrialEndsAtIso,
  isPlatformTrialPast,
  platformTrialDaysRemaining,
} from "@/lib/account/platform-trial";

export type SubscriptionGateRow = {
  plan_code?: string | null;
  status?: string | null;
  platform_trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Resolve product tier from billing_subscriptions row.
 * - Pro: active/trialing paid Stripe plan
 * - Trial: platform trial still valid
 * - Free: everyone else (expired trial, canceled Pro after period, missing row)
 */
export function resolvePlanTier(row: SubscriptionGateRow | null | undefined): PlanTier {
  if (hasActivePaidProSubscription(row)) return "pro";

  const platformEnd = effectivePlatformTrialEndsAtIso(row);
  if (platformEnd && !isPlatformTrialPast(platformEnd)) return "trial";

  return "free";
}

export function planEntitlementsFromBillingRow(
  row: SubscriptionGateRow | null | undefined,
): PlanEntitlements {
  const tier = resolvePlanTier(row);
  const platformEnd = effectivePlatformTrialEndsAtIso(row);
  const daysLeft =
    tier === "trial" ? platformTrialDaysRemaining(platformEnd) : null;
  return entitlementsForTier(tier, daysLeft);
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
