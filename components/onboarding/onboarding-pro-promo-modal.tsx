"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { markOnboardingComplete } from "@/lib/auth/onboarding";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "annually";

const MONTHLY_PRICE = 15;
const ANNUAL_PRICE = 150;

const FEATURES = [
  "Full historical financial data",
  "Advanced fundamental charts",
  "Unlimited portfolios and watchlists",
  "Portfolio performance tracking",
  "Premium charts and data",
  "Earnings data and calendar",
  "Faster data access and updates",
  "Ad-free experience",
];

/** Post-onboarding Pro upsell (Figma node 8884:393726). */
export function OnboardingProPromoModal({
  open,
  onSkip,
}: {
  open: boolean;
  onSkip: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [startingCheckout, setStartingCheckout] = useState(false);

  const priceText = useMemo(() => {
    if (cycle === "monthly") return `$${MONTHLY_PRICE.toFixed(2)}`;
    return `$${ANNUAL_PRICE.toFixed(2)}`;
  }, [cycle]);

  const suffixText = cycle === "monthly" ? "/ month" : "/ year";

  if (!open || typeof document === "undefined") return null;

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
      markOnboardingComplete();
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast.error(message);
      setStartingCheckout(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[282] flex items-center justify-center bg-black/40 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onSkip} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-pro-title"
        className="relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id="onboarding-pro-title" className="text-lg font-semibold leading-7 text-[#09090B]">
            Finsepa Pro
          </h2>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
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
            {FEATURES.map((item) => (
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
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 text-sm font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#E4E4E7]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={startingCheckout}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-[10px] bg-[#09090B] px-4 text-sm font-medium leading-5 text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#27272A]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {startingCheckout ? "Redirecting…" : "Get Started"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
