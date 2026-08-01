"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { whiteSurfaceButtonBorderClass, whiteSurfaceButtonShadowClass } from "@/components/design-system/secondary-button-styles";
import { cn } from "@/lib/utils";

const SEGMENT_MOTION_MS = 280;
const SEGMENT_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/**
 * Segmented control (“Button Group” in Figma Web-App-Design).
 * @see https://www.figma.com/design/YSUI0cOq1fIhZsGu1VuIOK/Web-App-Design?node-id=374-24183
 *
 * Track and segments use **10px** corner radius (not fully rounded). Active segment: white fill,
 * same border + light shadow as white-surface buttons; label **Inter Medium 14px / 20px / #141414** (Figma).
 * Inactive: zinc-500, regular weight.
 * Set {@link fullWidth} for a single joined row that spans the container (equal-width segments).
 * Icon-only options (non-string {@link SegmentedControlOption.label} + `aria-label`) use square `size-8` hit targets.
 */
export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** Accessible name when {@link label} is not plain text (e.g. icon-only). */
  "aria-label"?: string;
};

export type SegmentedControlSize = "sm" | "md";

const RADIUS = "rounded-[10px]";
/** Active thumb sits inside track pad — 2px tighter than the track. */
const ACTIVE_RADIUS = "rounded-[8px]";
const TRACK_PAD = "p-px";

/** Active thumb — light: same border + shadow as outline buttons; dark: fill + shadow, no stroke. */
const ACTIVE_THUMB_CHROME = cn(
  whiteSurfaceButtonBorderClass,
  whiteSurfaceButtonShadowClass,
  "bg-button dark:border-transparent dark:bg-[#2C2C2E]",
);

function isIconOnlyOption(opt: SegmentedControlOption): boolean {
  return typeof opt.label !== "string" && Boolean(opt["aria-label"]);
}

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
  // Size kept for API compatibility; track is locked to `h-9` to match outline buttons.
  void size;
  const iconOnly = options.length > 0 && options.every(isIconOnlyOption);
  /** Text segments: 12px pad. Icon-only: 32×32 square (width = height). */
  const padClasses = iconOnly ? "size-8 px-0" : "px-3";
  /** Figma: Inter Medium 14 / 20, letter-spacing 0 — active uses `font-medium`, inactive `font-normal`. */
  const labelTypography = "font-sans text-[14px] leading-5 tracking-normal";

  const trackRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, top: 0, height: 0 });
  /** Avoid animating from 0×0 on mount (e.g. New Transaction modal) — enable after first layout. */
  const [indicatorMotionEnabled, setIndicatorMotionEnabled] = useState(false);
  const hasPositionedOnceRef = useRef(false);

  const measureIndicator = useCallback(() => {
    const track = trackRef.current;
    const btn = segmentRefs.current.get(value);
    if (!track || !btn) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const width = Math.round(btnRect.width);
    const height = Math.round(btnRect.height);
    if (width <= 0 || height <= 0) return;
    setIndicator({
      left: Math.round(btnRect.left - trackRect.left - track.clientLeft),
      width,
      top: Math.round(btnRect.top - trackRect.top - track.clientTop),
      height,
    });
  }, [value]);

  useLayoutEffect(() => {
    measureIndicator();
    if (hasPositionedOnceRef.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measureIndicator();
      raf2 = requestAnimationFrame(() => {
        if (hasPositionedOnceRef.current) return;
        const btn = segmentRefs.current.get(value);
        if (!btn || btn.getBoundingClientRect().width <= 0) return;
        hasPositionedOnceRef.current = true;
        setIndicatorMotionEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
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
        "relative h-9 gap-0 bg-surface-subtle",
        iconOnly ? "items-center" : "items-stretch",
        RADIUS,
        TRACK_PAD,
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          "pointer-events-none absolute z-0 motion-reduce:transition-none",
          ACTIVE_RADIUS,
          ACTIVE_THUMB_CHROME,
        )}
        style={{
          left: indicator.left,
          width: indicator.width,
          top: indicator.top,
          height: indicator.height,
          opacity: indicator.width > 0 && indicator.height > 0 ? 1 : 0,
          transitionProperty: indicatorMotionEnabled ? "left, width, top, height" : "none",
          transitionDuration: indicatorMotionEnabled ? `${SEGMENT_MOTION_MS}ms` : "0ms",
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
            aria-label={opt["aria-label"]}
            className={cn(
              "relative z-[1] flex items-center justify-center",
              iconOnly ? "shrink-0" : "self-stretch",
              fullWidth && !iconOnly ? "min-w-0 flex-1 basis-0 text-center" : "min-w-0",
              !iconOnly && !fullWidth && "shrink-0",
              "cursor-pointer transition-[color,opacity] duration-100",
              iconOnly ? ACTIVE_RADIUS : RADIUS,
              padClasses,
              labelTypography,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
              active ? "font-medium text-fg" : "font-normal text-fg-muted hover:text-fg",
              opt.disabled && "cursor-not-allowed opacity-50 hover:text-fg-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
