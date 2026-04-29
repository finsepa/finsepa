export type BillingPlan = "trial" | "pro";

export type BillingHistoryRow = {
  id: string;
  date: string;
  amountUsd: number;
  description: string;
};

export type BillingSummary = {
  plan: BillingPlan;
  subscriptionMeta: string;
  recurringAmountUsd: number;
  recurringDueDate: string | null;
  paymentHistory: BillingHistoryRow[];
};

export const EMPTY_BILLING_SUMMARY: BillingSummary = {
  plan: "trial",
  subscriptionMeta: "Trial is active",
  recurringAmountUsd: 0,
  recurringDueDate: null,
  paymentHistory: [],
};
