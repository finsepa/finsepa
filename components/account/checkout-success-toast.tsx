"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { invalidateBillingSummaryMenuCache } from "@/lib/account/billing-summary-menu-cache";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const STORAGE_PREFIX = "finsepa_stripe_checkout_success:";

function isCheckoutSuccess(checkout: string | null, sessionId: string | null): boolean {
  if (checkout === "success") return true;
  return Boolean(sessionId && sessionId.startsWith("cs_"));
}

/** Fires once after Stripe Checkout redirects back with `checkout=success`. */
export function CheckoutSuccessToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const refreshPlan = usePlanAccessOptional()?.refreshPlan;

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id")?.trim() || null;
    if (!isCheckoutSuccess(checkout, sessionId)) return;

    const storageKey = `${STORAGE_PREFIX}${sessionId ?? pathname}`;
    const alreadyToasted = sessionStorage.getItem(storageKey) === "1";
    if (!alreadyToasted) {
      sessionStorage.setItem(storageKey, "1");
      toast.success("Welcome to Pro", {
        description: "Your subscription is active. Unlimited portfolios, watchlists, and alerts are unlocked.",
        duration: 8000,
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("checkout");
    params.delete("session_id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getUser();
      if (data.user) invalidateBillingSummaryMenuCache(data.user.id);
      await refreshPlan?.();
    })();
  }, [pathname, refreshPlan, router, searchParams]);

  return null;
}
