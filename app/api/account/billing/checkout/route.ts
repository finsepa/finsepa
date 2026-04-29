import { NextResponse } from "next/server";

import type { StripeBillingCycle } from "@/lib/stripe/server";
import { getStripePaymentLink } from "@/lib/stripe/server";
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
  const baseLink = getStripePaymentLink(cycle);
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
