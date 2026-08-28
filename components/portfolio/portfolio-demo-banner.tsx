"use client";

import { accentFillButtonClassName } from "@/components/design-system/secondary-button-styles";
import { Info } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Banner above the Free sample demo portfolio. */
export function PortfolioDemoBanner({
  className,
  onCreateOwn,
}: {
  className?: string;
  onCreateOwn: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-xl border border-info-border bg-info px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-info-fg" strokeWidth={2} aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-[14px] font-semibold leading-5 text-fg">This is a demo portfolio.</p>
          <p className="text-[13px] leading-5 text-fg-muted">
            When you&apos;re ready, create your own portfolio.
          </p>
        </div>
      </div>
      <button type="button" onClick={onCreateOwn} className={cn(accentFillButtonClassName, "w-full shrink-0 sm:w-auto")}>
        Create Portfolio
      </button>
    </div>
  );
}
