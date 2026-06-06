"use client";

import { ArrowLeftRight } from "@/lib/icons";

import { cn } from "@/lib/utils";

type FinancialsColumnOrderToggleProps = {
  reversed: boolean;
  onToggle: () => void;
  className?: string;
};

/** Swaps Financials statement columns between oldest→newest and newest→oldest. */
export function FinancialsColumnOrderToggle({
  reversed,
  onToggle,
  className,
}: FinancialsColumnOrderToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={reversed}
      aria-label={reversed ? "Show oldest years first" : "Show newest years first"}
      title={reversed ? "Oldest → newest" : "Newest → oldest"}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] outline-none transition-colors duration-100 hover:bg-[#F4F4F5] active:bg-white focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2",
        className,
      )}
    >
      <ArrowLeftRight className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}
