"use client";

import Image from "next/image";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { PRO_PLAN_FEATURES } from "@/lib/account/pro-plan-features";

type BillingCycle = "monthly" | "annually";

const MONTHLY_PRICE = 15;
const ANNUAL_PRICE = 150;

export function BillingUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [startingCheckout, setStartingCheckout] = useState(false);

  const priceText = useMemo(() => {
    if (cycle === "monthly") return `$${MONTHLY_PRICE.toFixed(2)}`;
    return `$${ANNUAL_PRICE.toFixed(2)}`;
  }, [cycle]);

  const suffixText = cycle === "monthly" ? "/ month" : "/ year";
  if (!open) return null;

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
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast.error(message);
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={260}>
      <AppModalShell
        titleId={titleId}
        title="Finsepa Pro"
        onClose={onClose}
        bodyClassName="space-y-8 px-5 py-5"
        footer={
          <AppModalFooter className="justify-end">
            <button
              type="button"
              onClick={() => {
                void startCheckout();
              }}
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
            { value: "annually", label: "Annually (17% off)" },
          ]}
          value={cycle}
          onChange={setCycle}
          fullWidth
          aria-label="Billing cycle"
        />

        <div className="flex items-end gap-2">
          <span className="text-[36px] font-bold leading-[40px] tracking-normal text-[#0A0A0A]">{priceText}</span>
          <span className="pb-1 text-[14px] font-normal leading-5 tracking-normal text-[#71717A]">{suffixText}</span>
        </div>

        <ul className="space-y-4">
          {PRO_PLAN_FEATURES.map((item) => (
            <li key={item} className="flex items-center gap-3">
              <Image
                src="/icons/finsepa-pro-check.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
              <span className="text-[14px] leading-5 text-[#0F0F0F]">{item}</span>
            </li>
          ))}
        </ul>
      </AppModalShell>
    </AppModalOverlay>
  );
}
