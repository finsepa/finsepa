"use client";

import { Check } from "@/lib/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { PRO_PLAN_FEATURES } from "@/lib/account/pro-plan-features";
import { markOnboardingCompleteForUser } from "@/lib/auth/onboarding";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { useClientMounted } from "./use-client-mounted";

type BillingCycle = "monthly" | "annually";

const MONTHLY_PRICE = 15;
const ANNUAL_PRICE = 150;

/** Post-onboarding Pro upsell (Figma node 8884:393726). */
export function OnboardingProPromoModal({
  open,
  onSkip,
}: {
  open: boolean;
  onSkip: () => void;
}) {
  const mounted = useClientMounted();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [startingCheckout, setStartingCheckout] = useState(false);

  const priceText = useMemo(() => {
    if (cycle === "monthly") return `$${MONTHLY_PRICE.toFixed(2)}`;
    return `$${ANNUAL_PRICE.toFixed(2)}`;
  }, [cycle]);

  const suffixText = cycle === "monthly" ? "/ month" : "/ year";

  if (!mounted || !open) return null;

  async function startCheckout() {
    setStartingCheckout(true);
    try {
      const res = await fetch("/api/account/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      await markOnboardingCompleteForUser(getSupabaseBrowserClient());
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast.error(message);
      setStartingCheckout(false);
    }
  }

  return (
    <AppModalOverlay open={open} onClose={onSkip} zIndex={282}>
      <AppModalShell
        titleId="onboarding-pro-title"
        title="Finsepa Pro"
        onClose={onSkip}
        bodyClassName="space-y-8 px-6 py-6"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onSkip} className={appModalCancelButtonClass}>
              Skip
            </button>
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={startingCheckout}
              className={appModalPrimaryButtonClass(!startingCheckout)}
            >
              {startingCheckout ? <SpinnerLabel>Redirecting…</SpinnerLabel> : "Get Started"}
            </button>
          </AppModalFooter>
        }
      >
        <SegmentedControl
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annually", label: "Annually" },
          ]}
          value={cycle}
          onChange={setCycle}
          fullWidth
          aria-label="Billing cycle"
        />

        <div className="flex items-end gap-2">
          <span className="text-[36px] font-bold leading-10 text-[#0A0A0A]">{priceText}</span>
          <span className="pb-1 text-sm leading-5 text-[#71717A]">{suffixText}</span>
        </div>

        <ul className="space-y-4">
          {PRO_PLAN_FEATURES.map((item) => (
            <li key={item} className="flex items-center gap-3">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#BFDBFE]"
                aria-hidden
              >
                <Check className="h-3 w-3 text-[#09090B]" strokeWidth={3} />
              </span>
              <span className="text-sm leading-5 text-[#09090B]">{item}</span>
            </li>
          ))}
        </ul>
      </AppModalShell>
    </AppModalOverlay>
  );
}
