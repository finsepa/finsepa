import { NextResponse } from "next/server";

import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import { upsertBillingSubscription } from "@/lib/account/billing-db";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import type { BillingCycle } from "@/lib/account/plan-pricing";
import { resolveBillingPriceIdForCycle } from "@/lib/stripe/resolve-billing-price";
import { getStripeAccountConfig, getStripeClient } from "@/lib/stripe/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function resolveCycle(input: unknown): BillingCycle {
  return input === "annually" ? "annually" : "monthly";
}

function cycleFromPlanCode(planCode: string | null | undefined): BillingCycle | null {
  if (!planCode) return null;
  if (planCode === "pro_annually") return "annually";
  if (planCode === "pro_monthly" || planCode === "pro") return "monthly";
  if (planCode.startsWith("pro_")) return "monthly";
  return null;
}

/**
 * Switch an active Pro subscription between monthly and annual prices (no new Checkout).
 */
export async function POST(req: Request) {
  const user = await resolveAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { cycle?: string };
  const targetCycle = resolveCycle(body?.cycle);

  const { data: subRow } = await admin
    .from("billing_subscriptions")
    .select(
      "plan_code,status,billing_provider,stripe_customer_id,stripe_subscription_id,stripe_account_key,stripe_price_id",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      plan_code: string;
      status: string;
      billing_provider: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_account_key: string | null;
      stripe_price_id: string | null;
    }>();

  if (!hasActivePaidProSubscription(subRow)) {
    return NextResponse.json(
      { error: "An active Pro subscription is required to change billing cycle." },
      { status: 400 },
    );
  }

  if (subRow?.billing_provider === "apple") {
    return NextResponse.json(
      { error: "This Pro plan is billed through Apple. Change monthly or yearly in the iOS app." },
      { status: 409 },
    );
  }

  const currentCycle = cycleFromPlanCode(subRow?.plan_code);
  if (currentCycle === targetCycle) {
    return NextResponse.json(
      { error: "You are already on this billing cycle." },
      { status: 400 },
    );
  }

  const subscriptionId = subRow?.stripe_subscription_id?.trim() || null;
  const customerId = subRow?.stripe_customer_id?.trim() || null;
  if (!subscriptionId || !customerId) {
    return NextResponse.json(
      {
        error:
          "Could not find your Stripe subscription. Open Manage Subscription to change your plan there.",
      },
      { status: 404 },
    );
  }

  const account = getStripeAccountConfig(subRow?.stripe_account_key ?? null);
  const stripe = getStripeClient(subRow?.stripe_account_key ?? null);
  if (!account || !stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  let subscription: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load subscription from Stripe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const itemId = subscription.items.data[0]?.id;
  const livePriceId =
    typeof subscription.items.data[0]?.price === "string"
      ? subscription.items.data[0]?.price
      : subscription.items.data[0]?.price?.id ?? subRow?.stripe_price_id ?? null;

  if (!itemId) {
    return NextResponse.json(
      { error: "Subscription has no items. Open Manage Subscription to change your plan." },
      { status: 400 },
    );
  }

  const priceId = await resolveBillingPriceIdForCycle({
    stripe,
    cycle: targetCycle,
    accountKey: account.key,
    currentPriceId: livePriceId,
  });

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          "Could not find a Stripe price for that cycle on your Pro product. Set STRIPE_PRICE_ID_ANNUAL (and monthly) in env, or open Manage Subscription.",
      },
      { status: 500 },
    );
  }

  if (livePriceId && livePriceId === priceId) {
    return NextResponse.json(
      { error: "You are already on this billing cycle." },
      { status: 400 },
    );
  }

  try {
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      payment_behavior: "error_if_incomplete",
    });

    await upsertBillingSubscription({
      userId: user.id,
      stripeAccountKey: account.key,
      stripeCustomerId: customerId,
      subscription: updated,
    });

    return NextResponse.json({
      ok: true,
      cycle: targetCycle,
      status: updated.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not change billing cycle. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
