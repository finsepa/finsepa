import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type BillingAccessState = "trial" | "pro" | "canceled" | "expired";

type BillingSubscriptionRow = {
  plan_code: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  recurring_amount_usd: number;
  stripe_account_key: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type BillingInvoiceRow = {
  id: string;
  paid_at: string;
  amount_usd: number;
  description: string;
};

function subscriptionMeta(status: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Cancels at period end";
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

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ data: subscription }, { data: invoices }] = await Promise.all([
      supabase.from("billing_subscriptions").select("*").eq("user_id", user.id).maybeSingle<BillingSubscriptionRow>(),
      supabase
        .from("billing_invoices")
        .select("id, paid_at, amount_usd, description")
        .eq("user_id", user.id)
        .order("paid_at", { ascending: false })
        .limit(100)
        .returns<BillingInvoiceRow[]>(),
    ]);

    const isStripeProPlan = !!subscription?.plan_code?.startsWith("pro_");
    const isActivePaidState = subscription?.status === "active" || subscription?.status === "trialing";
    const isPro = isStripeProPlan && isActivePaidState;

    // Ensure we can always show a deterministic next due date for active subscriptions.
    let recurringDueDate = isPro ? subscription?.current_period_end ?? null : null;
    if (
      isPro &&
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

    const nowMs = Date.now();
    const dueMs = recurringDueDate ? new Date(recurringDueDate).getTime() : null;

    let accessState: BillingAccessState = "trial";
    let accessEndsAt: string | null = null;

    if (isPro) {
      if (subscription?.cancel_at_period_end) {
        accessEndsAt = recurringDueDate;
        if (typeof dueMs === "number" && Number.isFinite(dueMs) && dueMs > nowMs) {
          accessState = "canceled"; // still Pro until accessEndsAt
        } else {
          accessState = "expired"; // period end passed (or unknown), treat as expired
        }
      } else {
        accessState = "pro";
      }
    } else if (isStripeProPlan) {
      // Previously Pro, but Stripe says it's not active/trialing anymore.
      accessState = "expired";
      accessEndsAt = recurringDueDate;
    }

    const plan: "pro" | "trial" = accessState === "pro" || accessState === "canceled" ? "pro" : "trial";

    return NextResponse.json({
      plan,
      accessState,
      accessEndsAt,
      subscriptionMeta: subscription
        ? subscriptionMeta(subscription.status, subscription.cancel_at_period_end)
        : "Trial is active",
      recurringAmountUsd: plan === "pro" ? subscription?.recurring_amount_usd ?? 0 : 0,
      recurringDueDate: plan === "pro" ? recurringDueDate : null,
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
