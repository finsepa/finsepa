"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const TAB_MOTION_MS = 280;
const TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/**
 * Design system: secondary tab row (e.g. Screener Companies / Gainers & Losers,
 * Portfolio Overview Assets / Allocation). Active tab uses a sliding soft gray pill.
 */
export type SecondaryTabItem<T extends string = string> = {
  id: T;
  label: string;
};

export function SecondaryTabs<T extends string>({
  items,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
  listClassName,
}: {
  items: readonly SecondaryTabItem<T>[];
  value: T;
  onValueChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
  listClassName?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, height: 0 });
  /** Avoid animating from 0×0 on mount (e.g. Screener Companies row after payload loads). */
  const [indicatorMotionEnabled, setIndicatorMotionEnabled] = useState(false);
  const hasPositionedOnceRef = useRef(false);

  const measureIndicator = useCallback(() => {
    const list = listRef.current;
    const btn = tabRefs.current.get(value);
    if (!list || !btn) return;
    const listRect = list.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const width = Math.round(btnRect.width);
    const height = Math.round(btnRect.height);
    if (width <= 0 || height <= 0) return;
    setIndicator({
      left: Math.round(btnRect.left - listRect.left + list.scrollLeft),
      width,
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
        const btn = tabRefs.current.get(value);
        if (!btn || btn.getBoundingClientRect().width <= 0) return;
        hasPositionedOnceRef.current = true;
        setIndicatorMotionEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [measureIndicator, items, value]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(list);
    list.addEventListener("scroll", measureIndicator, { passive: true });
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      list.removeEventListener("scroll", measureIndicator);
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div className={cn(className)}>
      <div
        ref={listRef}
        className={cn(
          "relative flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden pb-0.5 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0",
          listClassName,
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        <span
          className="pointer-events-none absolute top-0 z-0 rounded-[10px] bg-[#F4F4F5] motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            height: indicator.height || undefined,
            opacity: indicator.width > 0 && indicator.height > 0 ? 1 : 0,
            transitionProperty: indicatorMotionEnabled ? "left, width, height" : "none",
            transitionDuration: indicatorMotionEnabled ? `${TAB_MOTION_MS}ms` : "0ms",
            transitionTimingFunction: TAB_MOTION_EASE,
          }}
          aria-hidden
        />
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(item.id)}
              className={cn(
                "relative z-[1] shrink-0 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13px] font-medium leading-5 text-[#09090B] transition-[color,opacity] duration-100 sm:px-5 sm:text-[14px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                active ? "opacity-100" : "opacity-80 hover:opacity-100",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
