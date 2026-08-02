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

/** Welcome → 6-step tour → Pro upsell (skip entirely for paid Pro). */
export function ScreenerOnboardingHost({
  userId,
  serverShouldShow = false,
  isPro = false,
}: {
  userId: string;
  serverShouldShow?: boolean;
  /** Active paid Pro — never show first-run onboarding or the Pro upsell. */
  isPro?: boolean;
}) {
  const searchParams = useSearchParams();
  const openedRef = useRef(false);
  const [phase, setPhase] = useState<OnboardingPhase>(() => {
    if (isPro) return "idle";
    if (serverShouldShow && !hasCompletedOnboardingForUser(userId)) return "welcome";
    return "idle";
  });

  const openWelcome = useCallback(() => {
    if (isPro) return;
    if (openedRef.current) return;
    if (hasCompletedOnboardingForUser(userId)) return;
    openedRef.current = true;
    markOnboardingPending(userId);
    setPhase("welcome");
  }, [isPro, userId]);

  // Persist completion for Pro so future logins / other devices don’t re-open the flow.
  useEffect(() => {
    if (!isPro) return;
    if (hasCompletedOnboardingForUser(userId)) return;
    void markOnboardingCompleteForUser(getSupabaseBrowserClient());
    stripOnboardingQueryFromUrl();
    setPhase("idle");
    openedRef.current = true;
  }, [isPro, userId]);

  useEffect(() => {
    if (phase === "welcome" || phase === "tour") {
      preloadProductTourImages();
    }
  }, [phase]);

  useEffect(() => {
    if (isPro) return;

    let cancelled = false;

    async function resolve() {
      try {
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

        if (shouldShowWelcomeOnboarding(undefined, { isPro })) {
          stripOnboardingQueryFromUrl();
          if (!cancelled) openWelcome();
          return;
        }

        const supabase = getSupabaseBrowserClient();
        const user = await waitForSessionUser(supabase);
        if (cancelled || !user) return;

        if (user.id !== userId) return;

        if (shouldShowWelcomeOnboarding(user, { isPro }) || userNeedsOnboarding(user, { isPro })) {
          await persistOnboardingPendingOnUser(supabase);
          if (!cancelled) openWelcome();
        }
      } catch {
        /* Supabase offline — skip onboarding auto-open */
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
      if (shouldShowWelcomeOnboarding(user, { isPro }) || userNeedsOnboarding(user, { isPro })) {
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
  }, [isPro, openWelcome, searchParams, serverShouldShow, userId]);

  async function finishOnboarding() {
    const supabase = getSupabaseBrowserClient();
    await markOnboardingCompleteForUser(supabase);
    setPhase("idle");
  }

  function afterTour() {
    // Existing Pro subscribers never see the Free→Pro upsell.
    if (isPro) {
      void finishOnboarding();
      return;
    }
    setPhase("pro");
  }

  return (
    <>
      <WelcomeOnboardingModal open={phase === "welcome"} onContinue={() => setPhase("tour")} />
      <ProductTourModal
        open={phase === "tour"}
        onFinish={afterTour}
        onDismiss={afterTour}
      />
      <OnboardingProPromoModal open={phase === "pro"} onSkip={() => void finishOnboarding()} />
    </>
  );
}
