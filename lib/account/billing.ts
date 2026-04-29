export type BillingPlan = "trial" | "pro";

export type BillingAccessState = "trial" | "pro" | "canceled" | "expired";

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
  subscriptionMeta: string;
  recurringAmountUsd: number;
  recurringDueDate: string | null;
  paymentHistory: BillingHistoryRow[];
};

export const EMPTY_BILLING_SUMMARY: BillingSummary = {
  plan: "trial",
  accessState: "trial",
  accessEndsAt: null,
  subscriptionMeta: "Trial is active",
  recurringAmountUsd: 0,
  recurringDueDate: null,
  paymentHistory: [],
};
