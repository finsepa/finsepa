export type BillingPlan = "trial" | "free" | "pro";

export type BillingAccessState =
  | "trial"
  | "trial_expired"
  | "free"
  | "pro"
  | "canceled"
  | "expired"
  | "paused";

export type BillingHistoryRow = {
  id: string;
  date: string;
  amountUsd: number;
  description: string;
};

export type BillingSummary = {
  plan: BillingPlan;
  /** More detailed access state for UI messaging + paywall decisions. */
  accessState: BillingAccessState;
  /** When access will end (canceled) or ended (expired). ISO string. */
  accessEndsAt: string | null;
  /** Stripe: subscription is set to end after the current period (no renewal). */
  cancelAtPeriodEnd: boolean;
  /** When Stripe `pause_collection` will resume invoicing; null if not scheduled. */
  billingResumeAt: string | null;
  subscriptionMeta: string;
  recurringAmountUsd: number;
  recurringDueDate: string | null;
  paymentHistory: BillingHistoryRow[];
  /** App-level trial end (ISO). Null when not applicable (e.g. active Pro). */
  platformTrialEndsAt: string | null;
  /** Days left in the app trial for the top bar; null when not in an active countdown. */
  platformTrialDaysRemaining: number | null;
  /** Who bills Pro: Apple IAP or Stripe. Null on trial/free. */
  billingProvider?: "apple" | "stripe" | null;
  /** Paid Pro cadence. Null when not on Pro. */
  billingCycle?: "monthly" | "annually" | null;
};

export const EMPTY_BILLING_SUMMARY: BillingSummary = {
  plan: "trial",
  accessState: "trial",
  accessEndsAt: null,
  cancelAtPeriodEnd: false,
  billingResumeAt: null,
  subscriptionMeta: "Trial is active",
  recurringAmountUsd: 0,
  recurringDueDate: null,
  paymentHistory: [],
  platformTrialEndsAt: null,
  platformTrialDaysRemaining: null,
  billingProvider: null,
  billingCycle: null,
};

/** e.g. "Trial ends on Jun 30, 2026" — null when the end date is unknown. */
export function platformTrialEndsMetaLabel(platformTrialEndsAt: string | null | undefined): string | null {
  if (!platformTrialEndsAt) return null;
  const ms = Date.parse(platformTrialEndsAt);
  if (!Number.isFinite(ms)) return null;
  const label = new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Trial ends on ${label}`;
}

/** Same plan line as Account → Billing (e.g. “Free Trial”, “Pro”, “Free”). */
export function subscriptionTitleFromBillingSummary(summary: BillingSummary): string {
  const billingPlan = summary.plan;
  const billingAccessState = summary.accessState;
  if (billingPlan === "pro") return "Pro";
  if (billingPlan === "free" || billingAccessState === "free" || billingAccessState === "trial_expired") {
    return "Free";
  }
  return "Free Trial";
}
