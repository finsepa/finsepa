"use client";

import { resolveFsColor } from "@/lib/theme/resolve-fs-color";
import { cn } from "@/lib/utils";

/** Left green / right red split — matches baseline return charts (iOS earnings style). */
export function portfolioUpDownSplitGradient(): string {
  const up = resolveFsColor("--fs-up");
  const down = resolveFsColor("--fs-down");
  return `linear-gradient(to right, ${up} 50%, ${down} 50%)`;
}

/** Double-ring legend dot: outer + inner split circle (green / red). */
export function PortfolioUpDownLegendSwatch({ className }: { className?: string }) {
  const split = portfolioUpDownSplitGradient();
  return (
    <span
      className={cn(
        "relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full" style={{ background: split }} />
      <span className="absolute inset-[1.5px] rounded-full bg-surface" />
      <span className="absolute inset-[3px] rounded-full" style={{ background: split }} />
    </span>
  );
}
