import "server-only";

import type Stripe from "stripe";
import { EMPTY_BILLING_SUMMARY, type BillingSummary } from "@/lib/account/billing";
import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import { isPlatformTrialPast, platformTrialDaysRemaining as computePlatformTrialDaysRemaining } from "@/lib/account/platform-trial";
import { getStripeClient } from "@/lib/stripe/server";
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
  platform_trial_ends_at: string | null;
};

type BillingInvoiceRow = {
  id: string;
  paid_at: string;
  amount_usd: number;
  description: string;
};

function subscriptionMeta(status: string, cancelAtPeriodEnd: boolean, collectionPaused = false): string {
  if (collectionPaused) return "Billing paused";
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
      platformTrialEndsAt: null,
      platformTrialDaysRemaining: null,
      paymentHistory: (invoices ?? []).map((row) => ({
        id: row.id,
        date: row.paid_at,
        amountUsd: row.amount_usd,
        description: row.description || "Pro plan",
      })),
    };
  }

  const isPro = hasActivePaidProSubscription(subscription);
  const recurringAmountUsd = subscription.recurring_amount_usd ?? 0;
  const dueMs = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  let accessState: BillingSummary["accessState"] =
    isPro && subscription.cancel_at_period_end
      ? typeof dueMs === "number" && Number.isFinite(dueMs) && dueMs > Date.now()
        ? "canceled"
        : "expired"
      : isPro
        ? "pro"
        : "trial";

  const platformTrialEndsAtIso =
    typeof subscription.platform_trial_ends_at === "string" ? subscription.platform_trial_ends_at : null;
  if (!isPro && accessState === "trial" && isPlatformTrialPast(platformTrialEndsAtIso)) {
    accessState = "trial_expired";
  }

  let platformTrialDaysRemaining: number | null = null;
  if (
    !isPro &&
    accessState === "trial" &&
    platformTrialEndsAtIso &&
    !isPlatformTrialPast(platformTrialEndsAtIso)
  ) {
    platformTrialDaysRemaining = computePlatformTrialDaysRemaining(platformTrialEndsAtIso);
  }

  return {
    plan: isPro ? "pro" : "trial",
    accessState,
    accessEndsAt: subscription.cancel_at_period_end ? subscription.current_period_end : null,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    billingResumeAt: null,
    subscriptionMeta:
      accessState === "trial_expired"
        ? "Free trial ended — subscribe to continue"
        : subscriptionMeta(subscription.status, subscription.cancel_at_period_end, false),
    recurringAmountUsd: isPro ? recurringAmountUsd : 0,
    recurringDueDate: subscription.current_period_end,
    platformTrialEndsAt: isPro ? null : platformTrialEndsAtIso,
    platformTrialDaysRemaining,
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

export function resolvePlanCode(subscription: Stripe.Subscription): string {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === "year") return "pro_annually";
  if (interval === "month") return "pro_monthly";
  return "pro";
}

/** Best-effort recipient for billing notifications when `invoice.customer_email` is empty. */
export async function resolveStripeInvoiceRecipientEmail(args: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
  userId: string;
}): Promise<string | null> {
  const fromInvoice = args.invoice.customer_email?.trim();
  if (fromInvoice) return fromInvoice;

  const raw = args.invoice.customer;
  const customerId =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "deleted" in raw && raw.deleted
        ? null
        : raw && typeof raw === "object" && "id" in raw
          ? (raw as { id: string }).id
          : null;
  if (customerId) {
    try {
      const c = await args.stripe.customers.retrieve(customerId);
      if (!c.deleted && typeof c.email === "string") {
        const e = c.email.trim();
        if (e) return e;
      }
    } catch {
      /* ignore */
    }
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(args.userId);
  if (error || !data.user?.email) return null;
  const e = data.user.email.trim();
  return e || null;
}

export async function resolveUserEmailById(userId: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  const e = data.user.email.trim();
  return e || null;
}

/** True if we already recorded sending the Loops “Pro activated” welcome email. */
export async function hasProWelcomeEmailBeenSent(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return true;
  const { data } = await admin
    .from("billing_subscriptions")
    .select("pro_welcome_email_sent_at")
    .eq("user_id", userId)
    .maybeSingle<{ pro_welcome_email_sent_at: string | null }>();
  return !!data?.pro_welcome_email_sent_at;
}

export async function markProWelcomeEmailSent(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("billing_subscriptions")
    .update({
      pro_welcome_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
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
  const planCode = resolvePlanCode(args.subscription);
  const isPaidProWindow =
    planCode.startsWith("pro_") &&
    (args.subscription.status === "active" || args.subscription.status === "trialing");

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
      plan_code: planCode,
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

  if (isPaidProWindow) {
    await admin.from("billing_subscriptions").update({ platform_trial_ends_at: null }).eq("user_id", args.userId);
  }
}

export async function setSubscriptionTrial(args: { userId: string }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const platformEnds = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      plan_code: "trial",
      status: "trial",
      recurring_amount_usd: 0,
      current_period_end: null,
      cancel_at_period_end: false,
      platform_trial_ends_at: platformEnds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/** Best-effort label for billing UI / webhooks (matches Stripe line + price interval). */
export function stripeInvoiceUiDescription(invoice: Stripe.Invoice): string {
  const line = invoice.lines?.data?.[0];
  const typedLine = line as Stripe.InvoiceLineItem & {
    price?: Stripe.Price | null;
    plan?: { interval?: string | null } | null;
  };
  const interval = typedLine?.price?.recurring?.interval ?? typedLine?.plan?.interval ?? null;
  if (interval === "year") return "Pro annually";
  if (interval === "month") return "Pro monthly";
  return line?.description || invoice.description || "Pro plan";
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
  const paidTransition = args.invoice.status_transitions?.paid_at;
  const paidSec =
    typeof paidTransition === "number" && paidTransition > 0 ? paidTransition : args.invoice.created;
  await admin.from("billing_invoices").upsert(
    {
      user_id: args.userId,
      stripe_account_key: args.stripeAccountKey,
      stripe_invoice_id: args.invoice.id,
      stripe_subscription_id:
        typeof invoiceSubscriptionId === "string" ? invoiceSubscriptionId : null,
      amount_usd: Number(((args.invoice.amount_paid ?? 0) / 100).toFixed(2)),
      currency: (args.invoice.currency ?? "usd").toUpperCase(),
      paid_at: new Date(paidSec * 1000).toISOString(),
      description: args.description,
    },
    { onConflict: "stripe_account_key,stripe_invoice_id" },
  );
}

/**
 * Pull paid invoices from Stripe into `billing_invoices` (covers missed webhooks or local dev).
 * Requires service role + Stripe secret for the account key.
 */
export async function syncPaidInvoicesFromStripeForUser(args: {
  userId: string;
  stripeAccountKey: string | null | undefined;
  stripeCustomerId: string | null | undefined;
}): Promise<void> {
  const customerId = typeof args.stripeCustomerId === "string" ? args.stripeCustomerId.trim() : "";
  if (!customerId) return;
  const stripe = getStripeClient(args.stripeAccountKey ?? undefined);
  if (!stripe) return;
  if (!getSupabaseAdminClient()) return;

  const stripeAccountKey =
    typeof args.stripeAccountKey === "string" && args.stripeAccountKey.trim()
      ? args.stripeAccountKey.trim()
      : "primary";

  try {
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.invoices.list({
        customer: customerId,
        status: "paid",
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.lines.data.price"],
      });
      for (const invoice of page.data) {
        await upsertPaidInvoice({
          userId: args.userId,
          stripeAccountKey,
          invoice,
          description: stripeInvoiceUiDescription(invoice),
        });
      }
      if (!page.has_more) break;
      const last = page.data[page.data.length - 1];
      if (!last) break;
      startingAfter = last.id;
    }
  } catch (e) {
    console.error("[billing] syncPaidInvoicesFromStripeForUser failed", e);
  }
}

export async function getBillingSubscriptionStripeIdsForUser(userId: string): Promise<{
  stripe_subscription_id: string | null;
} | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("billing_subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  return data ?? null;
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
