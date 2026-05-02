export type BillingPlan = "trial" | "pro";

export type BillingAccessState = "trial" | "trial_expired" | "pro" | "canceled" | "expired" | "paused";

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
};

/** Same plan line as Account → Billing (e.g. “Free Trial”, “Pro”). */
export function subscriptionTitleFromBillingSummary(summary: BillingSummary): string {
  const billingPlan = summary.plan;
  const billingAccessState = summary.accessState;
  return billingPlan === "pro"
    ? "Pro"
    : billingAccessState === "trial_expired"
      ? "Free trial ended"
      : billingAccessState === "expired"
        ? "Free plan"
        : "Free Trial";
}
