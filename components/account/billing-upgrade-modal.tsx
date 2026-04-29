"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { SegmentedControl } from "@/components/design-system/segmented-control";

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

export function BillingUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast.error(message);
    } finally {
      setStartingCheckout(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label="Close upgrade modal backdrop"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[min(90vh,804px)] w-full max-w-[480px] min-h-0 flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h3 className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">Finsepa Pro</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5">
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
            {FEATURES.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Image
                  src="/icons/finsepa-pro-check.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0"
                  aria-hidden
                />
                <span className="text-[14px] leading-5 text-[#09090B]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 border-t border-[#E4E4E7] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              void startCheckout();
            }}
            disabled={startingCheckout}
            className="h-10 w-full rounded-[10px] bg-[#09090B] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#18181B] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#09090B]"
          >
            {startingCheckout ? "Redirecting…" : "Get Started"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

