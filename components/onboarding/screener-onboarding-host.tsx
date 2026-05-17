"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  hasOnboardingQueryFlag,
  markOnboardingComplete,
  markOnboardingPending,
  shouldMarkOnboardingAfterAuth,
  shouldShowWelcomeOnboarding,
  stripOnboardingQueryFromUrl,
} from "@/lib/auth/onboarding";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { OnboardingProPromoModal } from "./onboarding-pro-promo-modal";
import { ProductTourModal } from "./product-tour-modal";
import { WelcomeOnboardingModal } from "./welcome-onboarding-modal";

type OnboardingPhase = "idle" | "welcome" | "tour" | "pro";

/** Welcome → 6-step tour → Pro upsell (Figma 8884:413751 → 14090 → 373835). */
export function ScreenerOnboardingHost() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<OnboardingPhase>("idle");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (resolved) return;

    let cancelled = false;

    async function resolve() {
      if (shouldShowWelcomeOnboarding()) {
        if (!cancelled) {
          setPhase("welcome");
          setResolved(true);
        }
        stripOnboardingQueryFromUrl();
        return;
      }

      const fromQuery =
        hasOnboardingQueryFlag(searchParams.toString()) ||
        (typeof window !== "undefined" && hasOnboardingQueryFlag(window.location.search));

      if (fromQuery) {
        markOnboardingPending();
        stripOnboardingQueryFromUrl();
        if (!cancelled) {
          setPhase("welcome");
          setResolved(true);
        }
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && shouldMarkOnboardingAfterAuth(user, null)) {
          markOnboardingPending();
          if (!cancelled) {
            setPhase("welcome");
            setResolved(true);
          }
          return;
        }
      } catch {
        /* non-blocking */
      }

      if (!cancelled) setResolved(true);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [resolved, searchParams]);

  function finishOnboarding() {
    markOnboardingComplete();
    setPhase("idle");
  }

  function showProPromo() {
    setPhase("pro");
  }

  return (
    <>
      <WelcomeOnboardingModal open={phase === "welcome"} onContinue={() => setPhase("tour")} />
      <ProductTourModal
        open={phase === "tour"}
        onFinish={showProPromo}
        onDismiss={showProPromo}
      />
      <OnboardingProPromoModal open={phase === "pro"} onSkip={finishOnboarding} />
    </>
  );
}
