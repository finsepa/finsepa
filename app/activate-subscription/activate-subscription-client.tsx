"use client";

import { useState } from "react";
import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ActivateSubscriptionClient() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.replace(PATH_LOGIN);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="flex min-h-[var(--app-vh)] flex-col bg-[#F7F7F7]">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex w-full max-w-[420px] flex-col items-center rounded-[12px] bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <AuthBrandMark className="h-7 w-7" />
          <h1 className="mt-6 text-center text-[22px] font-semibold leading-7 tracking-tight text-[#09090B] sm:text-[26px]">
            Unlock full access
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-[#71717A]">
            Your trial has ended. Upgrade to continue tracking portfolios, analyzing markets, and accessing Finsepa Pro features.
          </p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="mt-8 h-11 w-full rounded-[10px] bg-[#09090B] text-sm font-semibold text-white transition-colors hover:bg-[#18181B]"
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="mt-4 text-sm font-medium text-[#71717A] underline-offset-4 transition-colors hover:text-[#09090B] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <p className="mt-4 w-full max-w-[420px] text-center text-xs leading-5 text-[#A1A1AA]">
          Cancel anytime · Secure payments powered by Stripe
        </p>
      </div>

      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm leading-6 text-[#71717A]">
        Need help? Contact us{" "}
        <a
          href="mailto:hi@finsepa.com"
          className="font-medium text-[#09090B] underline decoration-[#71717A] underline-offset-4 transition-colors hover:decoration-[#09090B]"
        >
          hi@finsepa.com
        </a>
      </p>

      <BillingUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}
