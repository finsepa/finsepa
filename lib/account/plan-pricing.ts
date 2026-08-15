/** Shared Pro list prices — keep checkout UI in sync. */
export type BillingCycle = "monthly" | "annually";

export const PRO_MONTHLY_USD = 15;
export const PRO_ANNUAL_USD = 150;

/** App Store list prices (US) — keep in sync with StoreKit / App Store Connect. */
export const APPLE_PRO_MONTHLY_USD = 17.99;
export const APPLE_PRO_ANNUAL_USD = 179.99;

/** ~17% off vs 12× monthly. */
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

/** Stale Apple rows that stored Stripe web list prices ($15 / $150). */
export function remapStripeListPriceToAppleUsd(usd: number): number {
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
