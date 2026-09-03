"use client";

import { cn } from "@/lib/utils";

export function PortfolioGoalProgressBar({
  progressPct,
  className,
}: {
  progressPct: number;
  className?: string;
}) {
  const progress = Math.min(100, Math.max(0, Number.isFinite(progressPct) ? progressPct : 0));

  return (
    <div
      className={cn("h-2 min-h-2 w-full min-w-0 overflow-hidden rounded-full bg-stroke", className)}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full min-h-2 rounded-full bg-accent"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
