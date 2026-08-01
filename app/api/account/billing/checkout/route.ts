import { NextResponse } from "next/server";

import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import { ensureStripeCustomerForCheckout } from "@/lib/account/billing-db";
import type { StripeBillingCycle } from "@/lib/stripe/server";
import {
  getStripeAccountConfig,
  getStripeBillingCheckoutUrls,
  getStripeClient,
  getStripePaymentLink,
  getStripeSubscriptionPriceId,
} from "@/lib/stripe/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function resolveCycle(input: unknown): StripeBillingCycle {
  return input === "annually" ? "annually" : "monthly";
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { cycle?: string };
  const cycle = resolveCycle(body?.cycle);

  const { data: subRow } = await supabase
    .from("billing_subscriptions")
    .select("plan_code,status,stripe_customer_id,stripe_account_key")
    .eq("user_id", user.id)
    .maybeSingle<{
      plan_code: string;
      status: string;
      stripe_customer_id: string | null;
      stripe_account_key: string | null;
    }>();

  if (hasActivePaidProSubscription(subRow)) {
    return NextResponse.json(
      {
        error:
          "You already have an active Pro subscription. Open Billing and use Manage subscription to change payment method or cancel.",
      },
      { status: 409 },
    );
  }

  const accountKey = subRow?.stripe_account_key ?? null;
  const account = getStripeAccountConfig(accountKey);
  if (!account) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  let stripeCustomerId = subRow?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const { data: custRow } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("stripe_account_key", account.key)
      .maybeSingle<{ stripe_customer_id: string }>();
    stripeCustomerId = custRow?.stripe_customer_id ?? null;
  }

  const priceId = getStripeSubscriptionPriceId(cycle, account.key);
  const stripe = getStripeClient(account.key);

  // Prefer Checkout Sessions when price IDs are configured — surface real errors instead of
  // silently falling through to Payment Links (wrong account / misconfigured price).
  if (priceId && stripe) {
    // Reuse one Stripe Customer so concurrent Upgrade clicks share a customer id
    // (webhook can cancel sibling live subscriptions on that customer).
    try {
      const ensured = await ensureStripeCustomerForCheckout({
        stripe,
        stripeAccountKey: account.key,
        userId: user.id,
        email: user.email,
        existingCustomerId: stripeCustomerId,
      });
      if (ensured) stripeCustomerId = ensured;
    } catch (error) {
      console.error("[billing] ensureStripeCustomerForCheckout failed", error);
    }

    const { successUrl, cancelUrl } = getStripeBillingCheckoutUrls(account);
    const baseSession = {
      mode: "subscription" as const,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { finsepa_user_id: user.id },
      },
    };

    const withCustomer = stripeCustomerId
      ? { ...baseSession, customer: stripeCustomerId }
      : user.email
        ? { ...baseSession, customer_email: user.email }
        : baseSession;

    // Same user+cycle within a short window returns the same Session (blocks double-click
    // creating two paid subscriptions). Bucketed so abandoned checkouts can retry after ~2m.
    const idempotencyBucket = Math.floor(Date.now() / 120_000);
    const idempotencyKey = `finsepa-checkout:${user.id}:${cycle}:${idempotencyBucket}`;

    try {
      const session = await stripe.checkout.sessions.create(withCustomer, {
        idempotencyKey,
      });
      if (session.url) {
        return NextResponse.json({ url: session.url });
      }
      return NextResponse.json(
        { error: "Stripe Checkout did not return a session URL. Try again." },
        { status: 502 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const invalidStoredCustomer =
        !!stripeCustomerId &&
        (message.includes("No such customer") || /resource_missing/i.test(message));
      if (invalidStoredCustomer && user.email) {
        try {
          const session = await stripe.checkout.sessions.create(
            {
              ...baseSession,
              customer_email: user.email,
            },
            { idempotencyKey: `${idempotencyKey}:email-fallback` },
          );
          if (session.url) {
            return NextResponse.json({ url: session.url });
          }
        } catch (retryError) {
          const retryMessage =
            retryError instanceof Error ? retryError.message : "Could not start Checkout.";
          return NextResponse.json({ error: retryMessage }, { status: 502 });
        }
      }
      return NextResponse.json(
        { error: message.trim() || "Could not start Stripe Checkout. Try again." },
        { status: 502 },
      );
    }
  }

  // Payment Links only when price IDs are not configured (legacy / env fallback).
  // Sibling cancel on checkout.session.completed is the safety net for double-pay races.
  const baseLink = getStripePaymentLink(cycle, account.key);
  if (!baseLink) {
    return NextResponse.json(
      {
        error:
          "Stripe is not fully configured. Set STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_ANNUAL (Checkout) or payment link env vars.",
      },
      { status: 500 },
    );
  }

  const checkoutUrl = new URL(baseLink);
  checkoutUrl.searchParams.set("client_reference_id", user.id);
  if (user.email) checkoutUrl.searchParams.set("prefilled_email", user.email);

  return NextResponse.json({ url: checkoutUrl.toString() });
}
