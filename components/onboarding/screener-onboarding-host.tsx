"use client";

import { useEffect, useState } from "react";

import { markOnboardingComplete, shouldShowWelcomeOnboarding } from "@/lib/auth/onboarding";

import { OnboardingProPromoModal } from "./onboarding-pro-promo-modal";
import { ProductTourModal } from "./product-tour-modal";
import { WelcomeOnboardingModal } from "./welcome-onboarding-modal";

type OnboardingPhase = "idle" | "welcome" | "tour" | "pro";

/** Welcome → 6-step tour → Pro upsell (Figma 8884:413751 → 14090 → 373835). */
export function ScreenerOnboardingHost() {
  const [phase, setPhase] = useState<OnboardingPhase>("idle");

  useEffect(() => {
    if (shouldShowWelcomeOnboarding()) {
      setPhase("welcome");
    }
  }, []);

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
