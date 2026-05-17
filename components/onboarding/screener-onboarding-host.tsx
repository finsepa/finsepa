"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  hasCompletedOnboardingForUser,
  hasOnboardingQueryFlag,
  markOnboardingPending,
  markOnboardingCompleteForUser,
  ONBOARDING_AUTH_READY_EVENT,
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

/** Welcome → 6-step tour → Pro upsell. */
export function ScreenerOnboardingHost({
  userId,
  serverShouldShow = false,
}: {
  userId: string;
  serverShouldShow?: boolean;
}) {
  const searchParams = useSearchParams();
  const openedRef = useRef(false);
  const [phase, setPhase] = useState<OnboardingPhase>(() => {
    if (serverShouldShow && !hasCompletedOnboardingForUser(userId)) return "welcome";
    return "idle";
  });

  const openWelcome = useCallback(() => {
    if (openedRef.current) return;
    if (hasCompletedOnboardingForUser(userId)) return;
    openedRef.current = true;
    markOnboardingPending(userId);
    setPhase("welcome");
  }, [userId]);

  useEffect(() => {
    if (phase === "welcome" || phase === "tour") {
      preloadProductTourImages();
    }
  }, [phase]);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (hasCompletedOnboardingForUser(userId)) return;

      if (serverShouldShow) {
        if (!cancelled) openWelcome();
        return;
      }

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

      if (user.id !== userId) return;

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
      if (cancelled || openedRef.current || hasCompletedOnboardingForUser(userId)) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") return;
      const user = session?.user;
      if (!user || user.id !== userId) return;
      if (shouldShowWelcomeOnboarding(user) || userNeedsOnboarding(user)) {
        void persistOnboardingPendingOnUser(supabase).then(() => {
          if (!cancelled) openWelcome();
        });
      }
    });

    const onAuthReady = () => {
      if (!cancelled) void resolve();
    };
    window.addEventListener(ONBOARDING_AUTH_READY_EVENT, onAuthReady);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener(ONBOARDING_AUTH_READY_EVENT, onAuthReady);
    };
  }, [openWelcome, searchParams, serverShouldShow, userId]);

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
