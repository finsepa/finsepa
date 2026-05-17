"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  hasCompletedOnboarding,
  hasOnboardingQueryFlag,
  markOnboardingPending,
  markOnboardingCompleteForUser,
  persistOnboardingPendingOnUser,
  shouldShowWelcomeOnboarding,
  stripOnboardingQueryFromUrl,
  userNeedsOnboarding,
  waitForSessionUser,
} from "@/lib/auth/onboarding";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { preloadProductTourImages } from "@/lib/onboarding/product-tour-steps";

import { OnboardingProPromoModal } from "./onboarding-pro-promo-modal";
import { ProductTourModal } from "./product-tour-modal";
import { WelcomeOnboardingModal } from "./welcome-onboarding-modal";

type OnboardingPhase = "idle" | "welcome" | "tour" | "pro";

/** Welcome → 6-step tour → Pro upsell (Figma 8884:413751 → 14090 → 373835). */
export function ScreenerOnboardingHost({ serverShouldShow = false }: { serverShouldShow?: boolean }) {
  const searchParams = useSearchParams();
  const openedRef = useRef(false);
  const [phase, setPhase] = useState<OnboardingPhase>(() => {
    if (serverShouldShow && !hasCompletedOnboarding()) return "welcome";
    return "idle";
  });

  const openWelcome = useCallback(() => {
    if (openedRef.current || hasCompletedOnboarding()) return;
    openedRef.current = true;
    markOnboardingPending();
    setPhase("welcome");
  }, []);

  useEffect(() => {
    if (phase === "welcome" || phase === "tour") {
      preloadProductTourImages();
    }
  }, [phase]);

  useEffect(() => {
    if (openedRef.current) return;

    if (serverShouldShow && !hasCompletedOnboarding()) {
      openWelcome();
      return;
    }

    let cancelled = false;

    async function resolve() {
      if (hasCompletedOnboarding()) return;

      const fromQuery =
        hasOnboardingQueryFlag(searchParams.toString()) ||
        (typeof window !== "undefined" && hasOnboardingQueryFlag(window.location.search));

      if (fromQuery) {
        stripOnboardingQueryFromUrl();
        const supabase = getSupabaseBrowserClient();
        await persistOnboardingPendingOnUser(supabase);
        if (!cancelled) openWelcome();
        return;
      }

      if (shouldShowWelcomeOnboarding()) {
        stripOnboardingQueryFromUrl();
        if (!cancelled) openWelcome();
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const user = await waitForSessionUser(supabase);
      if (cancelled || !user) return;

      if (shouldShowWelcomeOnboarding(user) || userNeedsOnboarding(user)) {
        await persistOnboardingPendingOnUser(supabase);
        if (!cancelled) openWelcome();
      }
    }

    void resolve();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || openedRef.current || hasCompletedOnboarding()) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") return;
      const user = session?.user;
      if (!user) return;
      if (shouldShowWelcomeOnboarding(user) || userNeedsOnboarding(user)) {
        void persistOnboardingPendingOnUser(supabase).then(() => {
          if (!cancelled) openWelcome();
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [openWelcome, searchParams, serverShouldShow]);

  async function finishOnboarding() {
    const supabase = getSupabaseBrowserClient();
    await markOnboardingCompleteForUser(supabase);
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
      <OnboardingProPromoModal open={phase === "pro"} onSkip={() => void finishOnboarding()} />
    </>
  );
}
