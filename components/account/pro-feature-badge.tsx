"use client";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { cn } from "@/lib/utils";

export const PRO_FEATURE_BADGE_TOOLTIP = "This feature is available on Pro only";

/**
 * Free-plan Pro gate badge — always shows a dwell tooltip on hover/focus.
 */
export function ProFeatureBadge({
  label = PRO_FEATURE_BADGE_TOOLTIP,
  delayMs = 400,
  zIndex,
  placement = "bottom",
  className,
}: {
  label?: string;
  delayMs?: number;
  /** Raise above modals (e.g. `350` inside `AppModalOverlay`). */
  zIndex?: number;
  placement?: "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <TopbarDelayedTooltip
      label={label}
      delayMs={delayMs}
      zIndex={zIndex}
      placement={placement}
      className={cn("inline-flex shrink-0", className)}
    >
      <span className="inline-flex shrink-0 items-center rounded-md bg-fg px-1.5 text-[11px] font-medium leading-4 text-surface">
        Pro
      </span>
    </TopbarDelayedTooltip>
  );
}
