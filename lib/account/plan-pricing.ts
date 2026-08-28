/** Shared Pro list prices — keep checkout UI in sync (web Stripe + App Store). */
export type BillingCycle = "monthly" | "annually";

export const PRO_MONTHLY_USD = 12.99;
export const PRO_ANNUAL_USD = 129;

/** App Store list prices (US) — same as Stripe; keep in sync with StoreKit / App Store Connect. */
export const APPLE_PRO_MONTHLY_USD = PRO_MONTHLY_USD;
export const APPLE_PRO_ANNUAL_USD = PRO_ANNUAL_USD;

/** Grandfathered list prices (pre–Aug 2026 unification). */
const LEGACY_PRO_MONTHLY_USD = 15;
const LEGACY_PRO_ANNUAL_USD = 150;
const LEGACY_APPLE_PRO_MONTHLY_USD = 17.99;
const LEGACY_APPLE_PRO_ANNUAL_USD = 179.99;

/** ~17% off vs 12× monthly ($155.88 → $129). */
export const PRO_ANNUAL_SAVINGS_PCT = 17;

export function proPriceForCycle(cycle: BillingCycle): number {
  return cycle === "monthly" ? PRO_MONTHLY_USD : PRO_ANNUAL_USD;
}

export function appleProPriceForCycle(cycle: BillingCycle): number {
  return cycle === "monthly" ? APPLE_PRO_MONTHLY_USD : APPLE_PRO_ANNUAL_USD;
}

export function looksLikeStripeWebProPrice(usd: number): boolean {
  return usd === PRO_MONTHLY_USD || usd === PRO_ANNUAL_USD;
}

/**
 * Stale Apple invoice rows that stored Stripe web list prices before unified pricing.
 * Grandfathered subscribers keep their stored transaction amount via {@link displayAppleBilledUsd}.
 */
export function remapStripeListPriceToAppleUsd(usd: number): number {
  if (usd === LEGACY_PRO_ANNUAL_USD) return LEGACY_APPLE_PRO_ANNUAL_USD;
  if (usd === LEGACY_PRO_MONTHLY_USD) return LEGACY_APPLE_PRO_MONTHLY_USD;
  if (usd === PRO_ANNUAL_USD) return APPLE_PRO_ANNUAL_USD;
  if (usd === PRO_MONTHLY_USD) return APPLE_PRO_MONTHLY_USD;
  return usd;
}

export function displayAppleBilledUsd(storedUsd: number, listedUsd: number): number {
  return storedUsd > 0 && !looksLikeStripeWebProPrice(storedUsd) ? storedUsd : listedUsd;
}

export function proPriceSuffix(cycle: BillingCycle): string {
  return cycle === "monthly" ? "/ month" : "/ year";
}

/** Map `billing_subscriptions.plan_code` → UI cycle when on paid Pro. */
export function billingCycleFromPlanCode(planCode: string | null | undefined): BillingCycle | null {
  if (!planCode) return null;
  if (planCode === "pro_annually") return "annually";
  if (planCode === "pro_monthly" || planCode === "pro") return "monthly";
  // Other pro_* variants (legacy) — treat as monthly.
  if (planCode.startsWith("pro_")) return "monthly";
  return null;
}
