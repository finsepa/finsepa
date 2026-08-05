import { redirect } from "next/navigation";

import { BillingPlansPageClient } from "@/components/account/billing-plans-page";
import { getBillingSummaryForUser } from "@/lib/account/billing-db";
import { billingCycleFromPlanCode } from "@/lib/account/plan-pricing";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPlansPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${PATH_LOGIN}?next=${encodeURIComponent("/account/plans")}`);
  }

  const summary = await getBillingSummaryForUser(user.id);
  const isPro = summary.plan === "pro";
  const isTrial = !isPro && (summary.plan === "trial" || summary.accessState === "trial");
  const isFree = !isPro && !isTrial;

  let activeCycle: "monthly" | "annually" | null = null;
  if (isPro) {
    const { data: row } = await supabase
      .from("billing_subscriptions")
      .select("plan_code")
      .eq("user_id", user.id)
      .maybeSingle<{ plan_code: string | null }>();
    activeCycle = billingCycleFromPlanCode(row?.plan_code) ?? "monthly";
  }

  return (
    <BillingPlansPageClient
      plan={{
        isPro,
        isTrial,
        isFree,
        planLabel: isPro ? "Pro" : isTrial ? "Trial" : "Free",
        activeCycle,
      }}
    />
  );
}
