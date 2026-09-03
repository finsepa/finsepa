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
      <div className="flex min-w-0 items-center gap-2.5">
        <Info className="size-4 shrink-0 text-info-fg" strokeWidth={2} aria-hidden />
        <p className="min-w-0 text-[14px] font-semibold leading-5 text-fg">This is a demo portfolio</p>
      </div>
      <button
        type="button"
        onClick={onCreateOwn}
        className={cn(accentFillButtonClassName, "h-7 w-auto rounded-[8px] px-2.5 text-[12px]")}
      >
        Create Portfolio
      </button>
    </div>
  );
}
