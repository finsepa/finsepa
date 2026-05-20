"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const SEGMENT_MOTION_MS = 280;
const SEGMENT_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

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

  const trackRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, top: 0, height: 0 });

  const measureIndicator = useCallback(() => {
    const track = trackRef.current;
    const btn = segmentRefs.current.get(value);
    if (!track || !btn) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - trackRect.left,
      width: btnRect.width,
      top: btnRect.top - trackRect.top,
      height: btnRect.height,
    });
  }, [value]);

  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, options, value]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(track);
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div
      ref={trackRef}
      className={cn(
        fullWidth ? "flex w-full min-w-0" : "inline-flex max-w-full min-w-0",
        "relative items-center gap-0 bg-[#F4F4F5]",
        RADIUS,
        TRACK_PAD,
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          "pointer-events-none absolute z-0 bg-white motion-reduce:transition-none",
          RADIUS,
          ACTIVE_SHADOW,
        )}
        style={{
          left: indicator.left,
          width: indicator.width,
          top: indicator.top,
          height: indicator.height || undefined,
          transitionProperty: "left, width, top, height",
          transitionDuration: `${SEGMENT_MOTION_MS}ms`,
          transitionTimingFunction: SEGMENT_MOTION_EASE,
        }}
        aria-hidden
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) segmentRefs.current.set(opt.value, el);
              else segmentRefs.current.delete(opt.value);
            }}
            type="button"
            disabled={opt.disabled}
            onClick={() => {
              if (opt.disabled) return;
              onChange(opt.value);
            }}
            aria-pressed={active}
            className={cn(
              "relative z-[1]",
              fullWidth ? "min-w-0 flex-1 basis-0 text-center" : "min-w-0 shrink-0",
              "cursor-pointer transition-[color,opacity] duration-100",
              RADIUS,
              padClasses,
              labelTypography,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              active ? "font-medium text-[#09090B]" : "font-normal text-[#71717A] hover:text-[#09090B]",
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
