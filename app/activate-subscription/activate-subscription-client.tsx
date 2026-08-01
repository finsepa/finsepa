"use client";

import { useState } from "react";
import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
import { loginSignedOutUrl } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ActivateSubscriptionClient() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.replace(loginSignedOutUrl());
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="flex min-h-[var(--app-vh)] flex-col bg-[#F7F7F7]">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex w-full max-w-[420px] flex-col items-center rounded-[12px] bg-surface p-8 shadow-[0_2px_10px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
          <AuthBrandMark />
          <h1 className="mt-6 text-center text-[22px] font-semibold leading-7 tracking-tight text-fg sm:text-[26px]">
            Unlock full access
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-fg-muted">
            Your trial has ended. Upgrade to continue tracking portfolios, analyzing markets, and accessing Finsepa Pro features.
          </p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="mt-8 h-11 w-full rounded-[10px] bg-fg text-sm font-semibold text-surface transition-colors hover:bg-[#18181B]"
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="mt-4 text-sm font-medium text-fg-muted underline-offset-4 transition-colors hover:text-fg disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <p className="mt-4 w-full max-w-[420px] text-center text-xs leading-5 text-fg-subtle">
          Cancel anytime · Secure payments powered by Stripe
        </p>
      </div>

      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm leading-6 text-fg-muted">
        Need help? Contact us{" "}
        <a
          href="mailto:hi@finsepa.com"
          className="font-medium text-fg underline decoration-fg-muted underline-offset-4 transition-colors hover:decoration-fg"
        >
          hi@finsepa.com
        </a>
      </p>

      <BillingUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}
