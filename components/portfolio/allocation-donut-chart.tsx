"use client";

import dynamic from "next/dynamic";

import type { AllocationDonutChartProps } from "@/components/portfolio/allocation-donut-chart.client";
import { cn } from "@/lib/utils";

const BADGE_OVERFLOW_PAD_PX = 36;

const AllocationDonutChartClient = dynamic(
  () =>
    import("@/components/portfolio/allocation-donut-chart.client").then(
      (m) => m.AllocationDonutChart,
    ),
  { ssr: false },
);

export type { AllocationDonutChartProps };

/** Client-only wrapper — SVG trig is not SSR-safe; shell reserves layout space while loading. */
export function AllocationDonutChart({ chartSizePx = 300, className, ...rest }: AllocationDonutChartProps) {
  const outerSizePx = chartSizePx + BADGE_OVERFLOW_PAD_PX * 2;

  return (
    <div
      className={cn("relative shrink-0 overflow-visible", className)}
      style={{ width: outerSizePx, height: outerSizePx }}
    >
      <AllocationDonutChartClient chartSizePx={chartSizePx} {...rest} />
    </div>
  );
}
