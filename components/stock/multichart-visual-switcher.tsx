"use client";

import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import { cn } from "@/lib/utils";

const CHART_VISUAL_OPTIONS = [
  { value: "line" as const, label: "Line" },
  { value: "bar" as const, label: "Bars" },
] as const;

export function MultichartVisualSwitcher({
  value,
  onChange,
  fullWidth = false,
  size = "md",
  className,
}: {
  value: MultichartVisual;
  onChange: (next: MultichartVisual) => void;
  fullWidth?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <SegmentedControl
      options={CHART_VISUAL_OPTIONS}
      value={value}
      onChange={onChange}
      size={size}
      fullWidth={fullWidth}
      aria-label="Chart style"
      className={cn(className)}
    />
  );
}
