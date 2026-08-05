/** Shared Pro list prices — keep checkout UI in sync. */
export type BillingCycle = "monthly" | "annually";

export const PRO_MONTHLY_USD = 15;
export const PRO_ANNUAL_USD = 150;

/** ~17% off vs 12× monthly. */
export const PRO_ANNUAL_SAVINGS_PCT = 17;

export function proPriceForCycle(cycle: BillingCycle): number {
  return cycle === "monthly" ? PRO_MONTHLY_USD : PRO_ANNUAL_USD;
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
