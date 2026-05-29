"use client";

import { BarChart3, LineChart } from "lucide-react";

import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import { cn } from "@/lib/utils";

const CHART_VISUAL_OPTIONS = [
  { value: "bar" as const, label: "Bars" },
  { value: "line" as const, label: "Line" },
] as const;

const ICON_ACTIVE_SHADOW =
  "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]";

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
  if (variant === "icon") {
    return (
      <div
        className={cn("flex shrink-0 gap-0 rounded-[10px] bg-[#F4F4F5] p-0.5", className)}
        role="group"
        aria-label="Chart style"
      >
        <button
          type="button"
          onClick={() => onChange("bar")}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
            value === "bar" ? ICON_ACTIVE_SHADOW : "text-[#71717A] hover:text-[#09090B]",
          )}
          aria-pressed={value === "bar"}
          aria-label="Bar chart"
        >
          <BarChart3 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onChange("line")}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
            value === "line" ? ICON_ACTIVE_SHADOW : "text-[#71717A] hover:text-[#09090B]",
          )}
          aria-pressed={value === "line"}
          aria-label="Line chart"
        >
          <LineChart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    );
  }

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
