"use client";

import { useRouter } from "next/navigation";
import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
import { AuthCornerActions } from "@/components/auth/auth-corner-actions";
import { loginSignedOutUrl, PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { signOutLocalSession } from "@/lib/auth/sign-out-local";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useState } from "react";

export function ActivateSubscriptionClient() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await signOutLocalSession(supabase);
      window.location.replace(loginSignedOutUrl());
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="flex min-h-[var(--app-vh)] flex-col bg-nav">
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
            onClick={() => router.push(PATH_ACCOUNT_PLANS)}
            className="mt-8 h-11 w-full rounded-[10px] bg-fg text-sm font-semibold text-surface transition-colors hover:bg-[#18181B] dark:hover:bg-fg/90"
          >
            Get Pro
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

      <AuthCornerActions />
    </main>
  );
}
