"use client";

import { BarChart3, LineChart } from "@/lib/icons";

import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import { cn } from "@/lib/utils";

const CHART_VISUAL_OPTIONS = [
  { value: "bar" as const, label: "Bars" },
  { value: "line" as const, label: "Line" },
] as const;

const CHART_VISUAL_ICON_OPTIONS = [
  {
    value: "bar" as const,
    "aria-label": "Bar chart",
    label: <BarChart3 className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
  },
  {
    value: "line" as const,
    "aria-label": "Line chart",
    label: <LineChart className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
  },
] as const;

/** Stock Charting tab uses `bars` | `line`; multicharts use `bar` | `line`. */
export type ChartingChartType = "bars" | "line";

export function ChartingVisualSwitcher({
  value,
  onChange,
  className,
}: {
  value: ChartingChartType;
  onChange: (next: ChartingChartType) => void;
  className?: string;
}) {
  return (
    <MultichartVisualSwitcher
      variant="icon"
      value={value === "bars" ? "bar" : "line"}
      onChange={(next) => onChange(next === "bar" ? "bars" : "line")}
      className={className}
    />
  );
}

export function MultichartVisualSwitcher({
  value,
  onChange,
  fullWidth = false,
  size = "md",
  variant = "labeled",
  className,
}: {
  value: MultichartVisual;
  onChange: (next: MultichartVisual) => void;
  fullWidth?: boolean;
  size?: "sm" | "md";
  /** Icon-only toggle (Figma Key Stats mobile sheet). */
  variant?: "labeled" | "icon";
  className?: string;
}) {
  return (
    <SegmentedControl
      options={variant === "icon" ? CHART_VISUAL_ICON_OPTIONS : CHART_VISUAL_OPTIONS}
      value={value}
      onChange={onChange}
      size={size}
      fullWidth={variant === "icon" ? false : fullWidth}
      aria-label="Chart style"
      className={cn(className)}
    />
  );
}
