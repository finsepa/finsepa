import { NextResponse } from "next/server";

import { getStripePortalReturnUrl, getStripeClient } from "@/lib/stripe/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: subscription } = await supabase
      .from("billing_subscriptions")
      .select("stripe_account_key,stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_account_key: string | null; stripe_customer_id: string | null }>();

    const stripeCustomerId = subscription?.stripe_customer_id ?? null;
    const stripeAccountKey = subscription?.stripe_account_key ?? null;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer is linked to this account yet." }, { status: 404 });
    }

    const stripe = getStripeClient(stripeAccountKey);
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured for this billing account." }, { status: 500 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: getStripePortalReturnUrl(stripeAccountKey),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open customer portal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
