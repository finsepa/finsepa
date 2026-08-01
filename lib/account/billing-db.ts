import "server-only";

import type Stripe from "stripe";
import { EMPTY_BILLING_SUMMARY, platformTrialEndsMetaLabel, type BillingSummary } from "@/lib/account/billing";
import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import {
  effectivePlatformTrialEndsAtIso,
  isPlatformTrialPast,
  platformTrialDaysRemaining as computePlatformTrialDaysRemaining,
} from "@/lib/account/platform-trial";
import { subscriptionUnitAmountUsdAfterDiscounts } from "@/lib/account/billing-stripe-amounts";
import { sendLoopsProRenewedEmail } from "@/lib/loops/send-pro-renewed";
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
  created_at?: string | null;
  updated_at?: string | null;
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
        description: row.description || "Finsepa Pro",
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

  const platformTrialEndsAtIso = effectivePlatformTrialEndsAtIso(subscription);
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
        ? "Free trial ended - subscribe to continue"
        : accessState === "trial"
          ? platformTrialEndsMetaLabel(platformTrialEndsAtIso) ??
            subscriptionMeta(subscription.status, subscription.cancel_at_period_end, false)
          : subscriptionMeta(subscription.status, subscription.cancel_at_period_end, false),
    recurringAmountUsd: isPro ? recurringAmountUsd : 0,
    recurringDueDate: subscription.current_period_end,
    platformTrialEndsAt: isPro ? null : platformTrialEndsAtIso,
    platformTrialDaysRemaining,
    paymentHistory: (invoices ?? []).map((row) => ({
      id: row.id,
      date: row.paid_at,
      amountUsd: row.amount_usd,
      description: row.description || "Finsepa Pro",
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
  if (!admin) {
    // Must not return false ? webhook treats false as duplicate and answers 200,
    // which stops Stripe retries while subscriptions never sync.
    throw new Error("Supabase admin client is not configured for Stripe webhooks.");
  }
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

/**
 * Resolve or create a Stripe Customer for Checkout Sessions so concurrent upgrades
 * share one customer (sibling-sub cancel in the webhook can then find duplicates).
 */
export async function ensureStripeCustomerForCheckout(args: {
  stripe: Stripe;
  stripeAccountKey: string;
  userId: string;
  email?: string | null;
  existingCustomerId?: string | null;
}): Promise<string | null> {
  const existing =
    typeof args.existingCustomerId === "string" ? args.existingCustomerId.trim() : "";
  if (existing) {
    try {
      const customer = await args.stripe.customers.retrieve(existing);
      if (!customer.deleted) return customer.id;
    } catch {
      /* stale id ù create below */
    }
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: row } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", args.userId)
      .eq("stripe_account_key", args.stripeAccountKey)
      .maybeSingle<{ stripe_customer_id: string }>();
    const fromDb = row?.stripe_customer_id?.trim();
    if (fromDb) {
      try {
        const customer = await args.stripe.customers.retrieve(fromDb);
        if (!customer.deleted) return customer.id;
      } catch {
        /* recreate */
      }
    }
  }

  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (!email) return null;

  const customer = await args.stripe.customers.create({
    email,
    metadata: { finsepa_user_id: args.userId },
  });
  await upsertBillingCustomer({
    userId: args.userId,
    stripeAccountKey: args.stripeAccountKey,
    stripeCustomerId: customer.id,
    email,
  });
  return customer.id;
}

/**
 * Cancel every other live subscription for this Finsepa user so a double-checkout
 * race cannot leave two Stripe subscriptions billing after webhooks land.
 */
export async function cancelOtherLiveSubscriptionsForUser(args: {
  stripe: Stripe;
  stripeAccountKey: string;
  userId: string;
  keepSubscriptionId: string;
  seedCustomerIds?: Array<string | null | undefined>;
  email?: string | null;
}): Promise<void> {
  const customerIds = new Set<string>();
  for (const id of args.seedCustomerIds ?? []) {
    if (typeof id === "string" && id.trim()) customerIds.add(id.trim());
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const [{ data: custRows }, { data: subRow }] = await Promise.all([
      admin
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("user_id", args.userId)
        .eq("stripe_account_key", args.stripeAccountKey)
        .returns<{ stripe_customer_id: string }[]>(),
      admin
        .from("billing_subscriptions")
        .select("stripe_customer_id,stripe_subscription_id")
        .eq("user_id", args.userId)
        .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>(),
    ]);
    for (const row of custRows ?? []) {
      if (row.stripe_customer_id) customerIds.add(row.stripe_customer_id);
    }
    if (subRow?.stripe_customer_id) customerIds.add(subRow.stripe_customer_id);
  }

  try {
    const found = await args.stripe.customers.search({
      query: `metadata['finsepa_user_id']:'${args.userId}'`,
      limit: 25,
    });
    for (const customer of found.data) customerIds.add(customer.id);
  } catch {
    /* Search API unavailable in some accounts ù DB + email fallback below */
  }

  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  if (email) {
    try {
      const listed = await args.stripe.customers.list({ email, limit: 25 });
      for (const customer of listed.data) {
        const metaUser = customer.metadata?.finsepa_user_id;
        if (metaUser && metaUser !== args.userId) continue;
        customerIds.add(customer.id);
      }
    } catch {
      /* ignore */
    }
  }

  for (const customerId of customerIds) {
    try {
      const page = await args.stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      for (const sub of page.data) {
        if (sub.id === args.keepSubscriptionId) continue;
        if (sub.status !== "active" && sub.status !== "trialing") continue;
        try {
          await args.stripe.subscriptions.cancel(sub.id);
        } catch (error) {
          console.error("[billing] failed to cancel sibling subscription", sub.id, error);
        }
      }
    } catch (error) {
      console.error("[billing] failed to list subscriptions for customer", customerId, error);
    }
  }
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

export async function hasProWelcomeEmailBeenSent(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  // Missing admin must not pretend the email was sent (that permanently skips it).
  if (!admin) return false;
  const { data } = await admin
    .from("billing_subscriptions")
    .select("pro_welcome_email_sent_at")
    .eq("user_id", userId)
    .maybeSingle<{ pro_welcome_email_sent_at: string | null }>();
  return !!data?.pro_welcome_email_sent_at;
}

/**
 * Atomically claim the Pro activated email slot (like renewal claim).
 * Returns true only for the first caller; clear with {@link clearProWelcomeEmailClaim} if Loops fails.
 */
export async function claimProWelcomeEmailSend(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { data: claimedRows, error } = await admin
    .from("billing_subscriptions")
    .update({
      pro_welcome_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("pro_welcome_email_sent_at", null)
    .select("user_id");
  if (error || !claimedRows?.length) return false;
  return true;
}

export async function clearProWelcomeEmailClaim(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("billing_subscriptions")
    .update({
      pro_welcome_email_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/**
 * Atomically claim the Welcome Trial Start email slot across concurrent triggers
 * (auth callback, onboarding bootstrap, protected shell).
 */
export async function claimWelcomeTrialEmailSend(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  // Ensure a billing row exists so the claim UPDATE can match (OAuth / race before trigger).
  const trialEnds = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan_code: "trial",
      status: "trial",
      platform_trial_ends_at: trialEnds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  const { data: claimedRows, error } = await admin
    .from("billing_subscriptions")
    .update({
      welcome_trial_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("welcome_trial_email_sent_at", null)
    .select("user_id");
  if (error || !claimedRows?.length) return false;
  return true;
}

export async function clearWelcomeTrialEmailClaim(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("billing_subscriptions")
    .update({
      welcome_trial_email_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** @deprecated Prefer {@link claimProWelcomeEmailSend}. */
export async function markProWelcomeEmailSent(userId: string): Promise<void> {
  await claimProWelcomeEmailSend(userId);
}

/** Best-effort admin write for fields reconciled from Stripe (summary UI). */
export async function patchBillingSubscriptionFromStripeReconcile(args: {
  userId: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  recurringAmountUsd?: number;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof args.status === "string") patch.status = args.status;
  if (typeof args.cancelAtPeriodEnd === "boolean") patch.cancel_at_period_end = args.cancelAtPeriodEnd;
  if (args.currentPeriodEnd !== undefined) patch.current_period_end = args.currentPeriodEnd;
  if (typeof args.recurringAmountUsd === "number") patch.recurring_amount_usd = args.recurringAmountUsd;
  await admin.from("billing_subscriptions").update(patch).eq("user_id", args.userId);
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
      recurring_amount_usd: subscriptionUnitAmountUsdAfterDiscounts(args.subscription),
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

  const { data: existing } = await admin
    .from("billing_subscriptions")
    .select("platform_trial_ends_at, created_at")
    .eq("user_id", args.userId)
    .maybeSingle<Pick<BillingSubscriptionRow, "platform_trial_ends_at" | "created_at">>();

  let platformEnds =
    typeof existing?.platform_trial_ends_at === "string" ? existing.platform_trial_ends_at.trim() : "";
  if (!platformEnds && existing?.created_at) {
    const created = new Date(existing.created_at);
    if (Number.isFinite(created.getTime())) {
      platformEnds = new Date(created.getTime() + 7 * 86_400_000).toISOString();
    }
  }
  if (!platformEnds) {
    platformEnds = new Date(0).toISOString();
  }

  await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      plan_code: "trial",
      status: "trial",
      recurring_amount_usd: 0,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      platform_trial_ends_at: platformEnds,
      // Allow Pro activated email again on a later purchase after cancel.
      pro_welcome_email_sent_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/** Best-effort label for billing UI / webhooks. */
export function stripeInvoiceUiDescription(_invoice: Stripe.Invoice): string {
  return "Finsepa Pro";
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

async function resolvePlanCodeFromInvoiceSubscription(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const subscriptionRaw = (invoice as unknown as { subscription?: unknown }).subscription;
  const subscriptionId =
    typeof subscriptionRaw === "string"
      ? subscriptionRaw
      : subscriptionRaw &&
          typeof subscriptionRaw === "object" &&
          "id" in subscriptionRaw &&
          (!("deleted" in subscriptionRaw) || !(subscriptionRaw as { deleted?: boolean }).deleted)
        ? (subscriptionRaw as { id: string }).id
        : null;
  if (!subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    return resolvePlanCode(sub);
  } catch {
    return null;
  }
}

/**
 * Loops "Pro renewed" once per invoice (`billing_reason` = subscription_cycle).
 * Claims `loops_renewal_email_sent_at` before sending; clears it if Loops fails (Stripe/webhook retry).
 */
export async function trySendLoopsProRenewalEmailForPaidInvoice(args: {
  userId: string;
  stripeAccountKey: string;
  stripe: Stripe;
  invoice: Stripe.Invoice;
  loopsApiKey: string;
  to: string;
  /** From an already-loaded Subscription (avoids an extra Stripe retrieve). */
  planCode?: string;
}): Promise<void> {
  if (args.invoice.billing_reason !== "subscription_cycle") return;

  let planCode = args.planCode;
  if (!planCode) {
    const resolved = await resolvePlanCodeFromInvoiceSubscription(args.stripe, args.invoice);
    if (!resolved) return;
    planCode = resolved;
  }
  if (!planCode.startsWith("pro")) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const { data: claimedRows, error: claimErr } = await admin
    .from("billing_invoices")
    .update({ loops_renewal_email_sent_at: new Date().toISOString() })
    .eq("user_id", args.userId)
    .eq("stripe_account_key", args.stripeAccountKey)
    .eq("stripe_invoice_id", args.invoice.id)
    .is("loops_renewal_email_sent_at", null)
    .select("id");

  if (claimErr || !claimedRows?.length) return;

  const sent = await sendLoopsProRenewedEmail({ apiKey: args.loopsApiKey, to: args.to });
  if (!sent.ok) {
    await admin
      .from("billing_invoices")
      .update({ loops_renewal_email_sent_at: null })
      .eq("user_id", args.userId)
      .eq("stripe_account_key", args.stripeAccountKey)
      .eq("stripe_invoice_id", args.invoice.id);
    console.error("[billing] Loops Pro renewal email failed:", sent.message);
  }
}

/**
 * Pull paid invoices from Stripe into `billing_invoices` (missed webhooks / backfill).
 * Does not send Loops emails - renewals stay webhook-only.
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
