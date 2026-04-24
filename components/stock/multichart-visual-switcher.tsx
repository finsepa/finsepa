"use client";

import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import { cn } from "@/lib/utils";

const CHART_VISUAL_OPTIONS = [
  { value: "line" as const, label: "Line", ariaLabel: "Line chart" },
  { value: "bar" as const, label: "Bars", ariaLabel: "Bar chart" },
] as const;

/** Matches {@link SegmentedControl} `size="md"`: `px-4 py-1.5`, Inter 14/20, 10px radius, track `p-0.5` & grey fill. */
const SEGMENT_MD = cn(
  "shrink-0 min-w-0 cursor-pointer rounded-[10px] px-4 py-1.5",
  "font-sans text-[14px] leading-5 tracking-normal",
  "transition-colors duration-100",
);
const SEGMENT_ACTIVE = "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]";
const SEGMENT_INACTIVE = "text-[#71717A] hover:text-[#09090B]";

export function MultichartVisualSwitcher({
  value,
  onChange,
}: {
  value: MultichartVisual;
  onChange: (next: MultichartVisual) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0 rounded-[10px] bg-[#F4F4F5] p-0.5"
      role="group"
      aria-label="Chart style"
    >
      {CHART_VISUAL_OPTIONS.map(({ value: v, label, ariaLabel }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={ariaLabel}
            title={ariaLabel}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex items-center justify-center",
              SEGMENT_MD,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              active ? cn("font-medium", SEGMENT_ACTIVE) : cn("font-normal", SEGMENT_INACTIVE),
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
