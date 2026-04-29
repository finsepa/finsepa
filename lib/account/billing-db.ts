import "server-only";

import type Stripe from "stripe";
import { EMPTY_BILLING_SUMMARY, type BillingSummary } from "@/lib/account/billing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type BillingSubscriptionRow = {
  user_id: string;
  stripe_account_key: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  recurring_amount_usd: number;
  plan_code: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type BillingInvoiceRow = {
  id: string;
  paid_at: string;
  amount_usd: number;
  description: string;
};

function planFromCode(planCode: string): "trial" | "pro" {
  return planCode.startsWith("pro_") ? "pro" : "trial";
}

function subscriptionMeta(status: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Cancels at period end";
  if (status === "trialing") return "Trialing";
  if (status === "past_due") return "Payment past due";
  if (status === "active") return "Active subscription";
  if (status === "unpaid") return "Payment required";
  return "Trial is active";
}

export async function getBillingSummaryForUser(userId: string): Promise<BillingSummary> {
  const admin = getSupabaseAdminClient();
  if (!admin) return EMPTY_BILLING_SUMMARY;

  const [{ data: subscription }, { data: invoices }] = await Promise.all([
    admin
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<BillingSubscriptionRow>(),
    admin
      .from("billing_invoices")
      .select("id, paid_at, amount_usd, description")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false })
      .limit(100)
      .returns<BillingInvoiceRow[]>(),
  ]);

  if (!subscription) {
    return {
      ...EMPTY_BILLING_SUMMARY,
      paymentHistory: (invoices ?? []).map((row) => ({
        id: row.id,
        date: row.paid_at,
        amountUsd: row.amount_usd,
        description: row.description || "Pro plan",
      })),
    };
  }

  const isPro = planFromCode(subscription.plan_code) === "pro";
  const recurringAmountUsd = subscription.recurring_amount_usd ?? 0;

  return {
    plan: isPro ? "pro" : "trial",
    subscriptionMeta: subscriptionMeta(subscription.status, subscription.cancel_at_period_end),
    recurringAmountUsd: isPro ? recurringAmountUsd : 0,
    recurringDueDate: subscription.current_period_end,
    paymentHistory: (invoices ?? []).map((row) => ({
      id: row.id,
      date: row.paid_at,
      amountUsd: row.amount_usd,
      description: row.description || "Pro plan",
    })),
  };
}

export async function recordWebhookEvent(args: {
  stripeAccountKey: string;
  stripeEventId: string;
  eventType: string;
  payload: unknown;
}): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("billing_webhook_events").insert({
    stripe_account_key: args.stripeAccountKey,
    stripe_event_id: args.stripeEventId,
    event_type: args.eventType,
    payload: args.payload,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function findUserIdByStripeCustomer(args: {
  stripeAccountKey: string;
  stripeCustomerId: string;
}): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_account_key", args.stripeAccountKey)
    .eq("stripe_customer_id", args.stripeCustomerId)
    .maybeSingle<{ user_id: string }>();
  return data?.user_id ?? null;
}

export async function upsertBillingCustomer(args: {
  userId: string;
  stripeAccountKey: string;
  stripeCustomerId: string;
  email?: string | null;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.from("billing_customers").upsert(
    {
      user_id: args.userId,
      stripe_account_key: args.stripeAccountKey,
      stripe_customer_id: args.stripeCustomerId,
      email: args.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,stripe_account_key" },
  );
}

function resolvePlanCode(subscription: Stripe.Subscription): string {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === "year") return "pro_annually";
  if (interval === "month") return "pro_monthly";
  return "pro";
}

export async function upsertBillingSubscription(args: {
  userId: string;
  stripeAccountKey: string;
  stripeCustomerId: string;
  subscription: Stripe.Subscription;
  /**
   * Stripe's Subscription payload can omit period fields depending on API version / expansions.
   * If provided, this overrides any derived current_period_end.
   */
  currentPeriodEndSeconds?: number | null;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const priceId = args.subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodEnd = (args.subscription as unknown as { current_period_end?: unknown })
    .current_period_end;
  const effectivePeriodEndSeconds =
    typeof args.currentPeriodEndSeconds === "number"
      ? args.currentPeriodEndSeconds
      : typeof currentPeriodEnd === "number"
        ? currentPeriodEnd
        : null;
  await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      stripe_account_key: args.stripeAccountKey,
      stripe_customer_id: args.stripeCustomerId,
      stripe_subscription_id: args.subscription.id,
      stripe_price_id: priceId,
      recurring_amount_usd: Number(
        ((args.subscription.items.data[0]?.price?.unit_amount ?? 0) / 100).toFixed(2),
      ),
      plan_code: resolvePlanCode(args.subscription),
      status: args.subscription.status,
      current_period_end:
        typeof effectivePeriodEndSeconds === "number"
          ? new Date(effectivePeriodEndSeconds * 1000).toISOString()
          : null,
      cancel_at_period_end: args.subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function setSubscriptionTrial(args: { userId: string }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      plan_code: "trial",
      status: "trial",
      recurring_amount_usd: 0,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function upsertPaidInvoice(args: {
  userId: string;
  stripeAccountKey: string;
  invoice: Stripe.Invoice;
  description: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const invoiceSubscriptionId = (args.invoice as unknown as { subscription?: unknown }).subscription;
  await admin.from("billing_invoices").upsert(
    {
      user_id: args.userId,
      stripe_account_key: args.stripeAccountKey,
      stripe_invoice_id: args.invoice.id,
      stripe_subscription_id:
        typeof invoiceSubscriptionId === "string" ? invoiceSubscriptionId : null,
      amount_usd: Number(((args.invoice.amount_paid ?? 0) / 100).toFixed(2)),
      currency: (args.invoice.currency ?? "usd").toUpperCase(),
      paid_at: new Date(args.invoice.created * 1000).toISOString(),
      description: args.description,
    },
    { onConflict: "stripe_account_key,stripe_invoice_id" },
  );
}

export async function getBillingSubscriptionIdentity(userId: string): Promise<{
  stripeAccountKey: string | null;
  stripeCustomerId: string | null;
}> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { stripeAccountKey: null, stripeCustomerId: null };
  const { data } = await admin
    .from("billing_subscriptions")
    .select("stripe_account_key,stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<{ stripe_account_key: string | null; stripe_customer_id: string | null }>();
  return {
    stripeAccountKey: data?.stripe_account_key ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
  };
}
