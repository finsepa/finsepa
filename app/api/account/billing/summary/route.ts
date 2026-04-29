import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type BillingSubscriptionRow = {
  plan_code: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  recurring_amount_usd: number;
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

    const isPro = !!subscription?.plan_code?.startsWith("pro_");
    return NextResponse.json({
      plan: isPro ? "pro" : "trial",
      subscriptionMeta: subscription
        ? subscriptionMeta(subscription.status, subscription.cancel_at_period_end)
        : "Trial is active",
      recurringAmountUsd: isPro ? subscription?.recurring_amount_usd ?? 0 : 0,
      recurringDueDate: subscription?.current_period_end ?? null,
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
