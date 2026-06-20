import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { syncPaidInvoicesFromStripeForUser } from "@/lib/account/billing-db";
import { resolveNextRecurringChargeUsd } from "@/lib/account/billing-stripe-amounts";
import {
  effectivePlatformTrialEndsAtIso,
  isPlatformTrialPast,
  platformTrialDaysRemaining as computePlatformTrialDaysRemaining,
} from "@/lib/account/platform-trial";
import { getStripeClient } from "@/lib/stripe/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type BillingAccessState = "trial" | "trial_expired" | "pro" | "canceled" | "expired" | "paused";

type BillingSubscriptionRow = {
  plan_code: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  recurring_amount_usd: number;
  stripe_account_key: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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

function subscriptionMeta(status: string, cancelAtPeriodEnd: boolean, collectionPaused: boolean): string {
  if (collectionPaused) return "Billing paused — no upcoming charges";
  // Stripe keeps status active/trialing until period ends; Billing UI shows “Active until …” using accessEndsAt.
  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) return "Cancellation scheduled";
  if (cancelAtPeriodEnd) return "Subscription ending";
  if (status === "trialing") return "Trialing";
  if (status === "past_due") return "Payment past due";
  if (status === "active") return "Active subscription";
  if (status === "unpaid") return "Payment required";
  return "Trial is active";
}

function addRecurringInterval(args: {
  anchorSeconds: number;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
}): string {
  const d = new Date(args.anchorSeconds * 1000);
  const c = Math.max(1, Math.floor(args.intervalCount || 1));
  switch (args.interval) {
    case "day":
      d.setUTCDate(d.getUTCDate() + c);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() + 7 * c);
      break;
    case "month":
      d.setUTCMonth(d.getUTCMonth() + c);
      break;
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + c);
      break;
    default:
      break;
  }
  return d.toISOString();
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ data: subscription }, firstInvoices] = await Promise.all([
      supabase.from("billing_subscriptions").select("*").eq("user_id", user.id).maybeSingle<BillingSubscriptionRow>(),
      supabase
        .from("billing_invoices")
        .select("id, paid_at, amount_usd, description")
        .eq("user_id", user.id)
        .order("paid_at", { ascending: false })
        .limit(100)
        .returns<BillingInvoiceRow[]>(),
    ]);

    let invoices = firstInvoices.data;
    if (subscription?.stripe_customer_id) {
      await syncPaidInvoicesFromStripeForUser({
        userId: user.id,
        stripeAccountKey: subscription.stripe_account_key,
        stripeCustomerId: subscription.stripe_customer_id,
      });
      const { data: refreshed } = await supabase
        .from("billing_invoices")
        .select("id, paid_at, amount_usd, description")
        .eq("user_id", user.id)
        .order("paid_at", { ascending: false })
        .limit(100)
        .returns<BillingInvoiceRow[]>();
      invoices = refreshed ?? invoices;
    }

    const planCodeRaw = subscription?.plan_code ?? "";
    const isStripeProPlan = planCodeRaw.startsWith("pro_") || planCodeRaw === "pro";

    // Reconcile Stripe truth (portal cancellations can lag in our DB until webhooks land).
    let stripeStatus = subscription?.status ?? "";
    let stripeCancelAtPeriodEnd = !!subscription?.cancel_at_period_end;
    let stripeCurrentPeriodEndIso = subscription?.current_period_end ?? null;
    let stripeCollectionPaused = false;
    let billingResumeAt: string | null = null;
    /** Stripe subscription object when retrieve succeeds (used for promo-aware billing). */
    let stripeSubscription: Stripe.Subscription | null = null;
    /** Stripe subscription.cancel_at (unix seconds), when retrieve succeeds */
    let cancelAtSecFromStripe: number | null = null;

    if (subscription?.stripe_subscription_id) {
      const stripe = getStripeClient(subscription.stripe_account_key);
      if (stripe) {
        try {
          const s = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
            expand: ["items.data.price", "discounts.source.coupon"],
          });
          stripeSubscription = s;
          stripeStatus = String(s.status ?? stripeStatus);
          stripeCollectionPaused = s.pause_collection != null;

          const resumeAt = s.pause_collection?.resumes_at;
          if (typeof resumeAt === "number") {
            billingResumeAt = new Date(resumeAt * 1000).toISOString();
          }

          const cpe = (s as unknown as { current_period_end?: unknown }).current_period_end;
          const cpeNum = typeof cpe === "number" ? cpe : null;
          if (typeof cpe === "number") {
            stripeCurrentPeriodEndIso = new Date(cpe * 1000).toISOString();
          }

          const cancelAtTs = (s as unknown as { cancel_at?: unknown }).cancel_at;
          const cancelAtNum = typeof cancelAtTs === "number" ? cancelAtTs : null;
          cancelAtSecFromStripe = cancelAtNum;

          const nowSecRetrieve = Math.floor(Date.now() / 1000);
          // Treat any future cancel_at on an entitled subscription as “scheduled cancellation”
          // (covers portal / API variants where cancel_at_period_end lags or differs slightly).
          stripeCancelAtPeriodEnd =
            !!s.cancel_at_period_end ||
            (cancelAtNum != null && cpeNum != null && cancelAtNum === cpeNum) ||
            (cancelAtNum != null &&
              cancelAtNum > nowSecRetrieve &&
              (stripeStatus === "active" || stripeStatus === "trialing"));

          // Best-effort: keep DB aligned for other server paths that still read the row directly.
          try {
            await supabase
              .from("billing_subscriptions")
              .update({
                status: stripeStatus,
                cancel_at_period_end: stripeCancelAtPeriodEnd,
                ...(stripeCurrentPeriodEndIso ? { current_period_end: stripeCurrentPeriodEndIso } : {}),
              })
              .eq("user_id", user.id)
              .throwOnError();
          } catch {
            // ignore
          }
        } catch {
          // ignore — fall back to DB fields
        }
      }
    }

    // Webhooks can lag behind the portal; trust DB if it already reflects cancel_at_period_end.
    stripeCancelAtPeriodEnd = stripeCancelAtPeriodEnd || !!subscription?.cancel_at_period_end;

    const isActivePaidState = stripeStatus === "active" || stripeStatus === "trialing";
    const isPro = isStripeProPlan && isActivePaidState;

    // Next billing/access end date. Paused subs have no scheduled invoice.
    // cancel_at_period_end: do not use retrieveUpcoming / anchor math — it can imply a renewal "next payment".
    let recurringDueDate = isPro && !stripeCollectionPaused ? stripeCurrentPeriodEndIso ?? null : null;
    if (
      isPro &&
      !stripeCollectionPaused &&
      !stripeCancelAtPeriodEnd &&
      !recurringDueDate &&
      subscription?.stripe_customer_id &&
      subscription?.stripe_subscription_id
    ) {
      const stripe = getStripeClient(subscription.stripe_account_key);
      if (stripe) {
        try {
          // First choice: upcoming invoice has explicit line period end.
          const upcoming = await (stripe.invoices as unknown as { retrieveUpcoming: (args: any) => Promise<any> })
            .retrieveUpcoming({
              customer: subscription.stripe_customer_id,
              subscription: subscription.stripe_subscription_id,
            });
          const endSeconds =
            typeof upcoming?.lines?.data?.[0]?.period?.end === "number" ? upcoming.lines.data[0].period.end : null;
          if (typeof endSeconds === "number") {
            recurringDueDate = new Date(endSeconds * 1000).toISOString();
          }
        } catch {
          // ignore and fall back to subscription anchor
        }

        if (!recurringDueDate) {
          try {
            const s = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
              expand: ["items.data.price"],
            });
            const anchorSeconds =
              typeof s.billing_cycle_anchor === "number"
                ? s.billing_cycle_anchor
                : typeof s.created === "number"
                  ? s.created
                  : null;
            const price = s.items?.data?.[0]?.price;
            const interval = price?.recurring?.interval;
            const intervalCount = price?.recurring?.interval_count ?? 1;
            if (
              typeof anchorSeconds === "number" &&
              (interval === "day" || interval === "week" || interval === "month" || interval === "year")
            ) {
              recurringDueDate = addRecurringInterval({ anchorSeconds, interval, intervalCount });
            }
          } catch {
            // ignore
          }
        }

        // Cache it for future loads (ignore failures).
        if (recurringDueDate) {
          try {
            await supabase
              .from("billing_subscriptions")
              .update({ current_period_end: recurringDueDate })
              .eq("user_id", user.id)
              .throwOnError();
          } catch {
            // ignore
          }
        }
      }
    }

    if (isPro && stripeCancelAtPeriodEnd && !stripeCollectionPaused) {
      recurringDueDate = stripeCurrentPeriodEndIso ?? recurringDueDate;
    }

    const nowMs = Date.now();

    let accessState: BillingAccessState = "trial";
    let accessEndsAt: string | null = null;

    if (isPro) {
      if (stripeCollectionPaused) {
        accessState = "paused";
        accessEndsAt = null;
      } else if (stripeCancelAtPeriodEnd) {
        const nowSecAccess = Math.floor(Date.now() / 1000);
        const endFromStripeCancel =
          cancelAtSecFromStripe != null && cancelAtSecFromStripe > nowSecAccess
            ? new Date(cancelAtSecFromStripe * 1000).toISOString()
            : null;
        const endIso = endFromStripeCancel ?? stripeCurrentPeriodEndIso ?? recurringDueDate ?? null;
        accessEndsAt = endIso;
        const endMs = endIso ? new Date(endIso).getTime() : NaN;
        if (!Number.isFinite(endMs)) {
          accessState = "canceled";
        } else if (endMs > nowMs) {
          accessState = "canceled";
        } else {
          accessState = "expired";
        }
      } else {
        accessState = "pro";
      }
    } else if (isStripeProPlan) {
      // Previously Pro, but Stripe says it's not active/trialing anymore.
      accessState = "expired";
      accessEndsAt = stripeCurrentPeriodEndIso ?? recurringDueDate;
    }

    const platformTrialEndsAtIso = effectivePlatformTrialEndsAtIso(subscription ?? null);

    if (!isPro && accessState === "trial" && isPlatformTrialPast(platformTrialEndsAtIso)) {
      accessState = "trial_expired";
    }

    const plan: "pro" | "trial" =
      accessState === "pro" || accessState === "canceled" || accessState === "paused" ? "pro" : "trial";

    const cancelAtPeriodEndActive = isPro && stripeCancelAtPeriodEnd && !stripeCollectionPaused;

    let recurringAmountUsd = plan === "pro" ? subscription?.recurring_amount_usd ?? 0 : 0;
    if (
      plan === "pro" &&
      !cancelAtPeriodEndActive &&
      !stripeCollectionPaused &&
      subscription?.stripe_customer_id &&
      subscription?.stripe_subscription_id
    ) {
      const stripe = getStripeClient(subscription.stripe_account_key);
      if (stripe) {
        const resolved = await resolveNextRecurringChargeUsd({
          stripe,
          customerId: subscription.stripe_customer_id,
          subscriptionId: subscription.stripe_subscription_id,
          subscription: stripeSubscription,
          fallbackUsd: subscription.recurring_amount_usd ?? 0,
        });
        if (resolved != null) {
          recurringAmountUsd = resolved;
          if (resolved !== (subscription.recurring_amount_usd ?? 0)) {
            try {
              await supabase
                .from("billing_subscriptions")
                .update({ recurring_amount_usd: resolved })
                .eq("user_id", user.id)
                .throwOnError();
            } catch {
              /* ignore */
            }
          }
        }
      }
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

    const subscriptionMetaOut =
      accessState === "trial_expired"
        ? "Free trial ended — subscribe to continue"
        : accessState === "expired"
          ? "No active subscription"
          : subscription
            ? subscriptionMeta(stripeStatus, stripeCancelAtPeriodEnd, stripeCollectionPaused)
            : "Trial is active";

    return NextResponse.json({
      plan,
      accessState,
      accessEndsAt,
      cancelAtPeriodEnd: cancelAtPeriodEndActive,
      billingResumeAt: accessState === "paused" ? billingResumeAt : null,
      subscriptionMeta: subscriptionMetaOut,
      recurringAmountUsd,
      // Cancel at period end: no renewal invoice — never send a "next payment" date for that case.
      recurringDueDate: plan === "pro" && !cancelAtPeriodEndActive ? recurringDueDate : null,
      platformTrialEndsAt: isPro ? null : platformTrialEndsAtIso,
      platformTrialDaysRemaining,
      paymentHistory: (invoices ?? []).map((row) => ({
        id: row.id,
        date: row.paid_at,
        amountUsd: row.amount_usd,
        description: row.description || "Pro plan",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
