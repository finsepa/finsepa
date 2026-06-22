import { NextResponse } from "next/server";

import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
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

  if (priceId && stripe) {
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

    try {
      const session = await stripe.checkout.sessions.create(withCustomer);
      if (session.url) {
        return NextResponse.json({ url: session.url });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const invalidStoredCustomer =
        !!stripeCustomerId &&
        (message.includes("No such customer") || /resource_missing/i.test(message));
      if (invalidStoredCustomer && user.email) {
        try {
          const session = await stripe.checkout.sessions.create({
            ...baseSession,
            customer_email: user.email,
          });
          if (session.url) {
            return NextResponse.json({ url: session.url });
          }
        } catch {
          // fall through to payment link
        }
      }
      // fall through to payment link
    }
  }

  const baseLink = getStripePaymentLink(cycle, account.key);
  if (!baseLink) {
    return NextResponse.json(
      { error: "Stripe payment link is not configured for this plan." },
      { status: 500 },
    );
  }

  const checkoutUrl = new URL(baseLink);
  checkoutUrl.searchParams.set("client_reference_id", user.id);
  if (user.email) checkoutUrl.searchParams.set("prefilled_email", user.email);

  return NextResponse.json({ url: checkoutUrl.toString() });
}
