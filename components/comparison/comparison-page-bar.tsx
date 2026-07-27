"use client";

import { RefreshCw } from "@/lib/icons";

import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { cn } from "@/lib/utils";

/** Charting-style page title row — large title + refresh on the right. */
export function ComparisonPageBar({
  title = "Comparison",
  onReset,
  resetDisabled = false,
  resetLabel = "Remove all companies and reset comparison",
  showReset = true,
}: {
  title?: string;
  onReset?: () => void;
  resetDisabled?: boolean;
  resetLabel?: string;
  showReset?: boolean;
}) {
  const disabled = !showReset || !onReset || resetDisabled;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <h1 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#141414] sm:flex-1">
        {title}
      </h1>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className={cn(topbarSquircleIconClass, "disabled:cursor-not-allowed disabled:opacity-40")}
        aria-label={showReset ? resetLabel : "Refresh (add a company first)"}
        title={showReset ? resetLabel : undefined}
      >
        <RefreshCw className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
