"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented control (“Button Group” in Figma Web-App-Design).
 * @see https://www.figma.com/design/YSUI0cOq1fIhZsGu1VuIOK/Web-App-Design?node-id=374-24183
 *
 * Track and segments use **10px** corner radius (not fully rounded). Active segment: white fill,
 * soft shadow; label **Inter Medium 14px / 20px / #09090B** (Figma). Inactive: zinc-500, regular weight.
 * Set {@link fullWidth} for a single joined row that spans the container (equal-width segments).
 */
export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlSize = "sm" | "md";

const RADIUS = "rounded-[10px]";
const TRACK_PAD = "p-0.5";

const ACTIVE_SHADOW =
  "shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  "aria-label": ariaLabel,
  className,
}: {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: SegmentedControlSize;
  /** When true, the track spans 100% width and each segment shares space equally (button group). */
  fullWidth?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const padClasses = size === "sm" ? "px-3 py-1.5" : "px-4 py-1.5";
  /** Figma: Inter Medium 14 / 20, letter-spacing 0 — active uses `font-medium`, inactive `font-normal`. */
  const labelTypography = "font-sans text-[14px] leading-5 tracking-normal";

  return (
    <div
      className={cn(
        fullWidth ? "flex w-full min-w-0" : "inline-flex max-w-full min-w-0",
        "items-center gap-0 bg-[#F4F4F5]",
        RADIUS,
        TRACK_PAD,
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => {
              if (opt.disabled) return;
              onChange(opt.value);
            }}
            aria-pressed={active}
            className={cn(
              fullWidth ? "min-w-0 flex-1 basis-0 text-center" : "min-w-0 shrink-0",
              "cursor-pointer transition-colors duration-100",
              RADIUS,
              padClasses,
              labelTypography,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              active
                ? cn("bg-white font-medium text-[#09090B]", ACTIVE_SHADOW)
                : "font-normal text-[#71717A] hover:text-[#09090B]",
              opt.disabled && "cursor-not-allowed opacity-50 hover:text-[#71717A]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
