"use client";

import dynamic from "next/dynamic";

import type { AllocationDonutChartProps } from "@/components/portfolio/allocation-donut-chart.client";
import { cn } from "@/lib/utils";

const AllocationDonutChartClient = dynamic(
  () =>
    import("@/components/portfolio/allocation-donut-chart.client").then(
      (m) => m.AllocationDonutChart,
    ),
  { ssr: false },
);

export type { AllocationDonutChartProps };

const DEFAULT_BADGE_OVERFLOW_PAD_PX = 36;

/** Client-only wrapper — SVG trig is not SSR-safe; shell reserves layout space while loading. */
export function AllocationDonutChart({
  chartSizePx = 300,
  badgeOverflowPadPx = DEFAULT_BADGE_OVERFLOW_PAD_PX,
  className,
  ...rest
}: AllocationDonutChartProps) {
  const outerSizePx = chartSizePx + badgeOverflowPadPx * 2;

  return (
    <div
      className={cn("relative shrink-0 overflow-visible", className)}
      style={{ width: outerSizePx, height: outerSizePx }}
    >
      <AllocationDonutChartClient
        chartSizePx={chartSizePx}
        badgeOverflowPadPx={badgeOverflowPadPx}
        {...rest}
      />
    </div>
  );
}
