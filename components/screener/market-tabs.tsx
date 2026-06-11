"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const tabs = ["Stocks", "Crypto", "Indices", "ETF's"] as const;
export type MarketTab = (typeof tabs)[number];

const TAB_MOTION_MS = 280;
const TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

export type UnderlineTabOption<T extends string> = {
  value: T;
  label: string;
};

function normalizeUnderlineTabs<T extends string>(
  tabList: readonly T[] | readonly UnderlineTabOption<T>[],
): UnderlineTabOption<T>[] {
  return tabList.map((t) => (typeof t === "string" ? { value: t, label: t } : t));
}

/** Primary underline tabs — shared by Screener (Stocks/Crypto/Indices) and Portfolio (Overview/Performance/Cash/…). */
export function UnderlineTabs<T extends string>({
  tabs: tabList,
  active,
  onChange,
  ariaLabel,
  trailing,
  className,
}: {
  tabs: readonly T[] | readonly UnderlineTabOption<T>[];
  active: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
  /** Right side of the tab row (e.g. U.S. markets session on `/screener`). */
  trailing?: ReactNode;
  className?: string;
}) {
  const options = useMemo(() => normalizeUnderlineTabs(tabList), [tabList]);
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  /** Avoid underline sliding from x=0 on first Screener paint. */
  const [indicatorMotionEnabled, setIndicatorMotionEnabled] = useState(false);
  const hasPositionedOnceRef = useRef(false);

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(active);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = Math.round(btnRect.left - navRect.left + nav.scrollLeft);
    const width = Math.round(btnRect.width);
    if (width <= 0) return;
    setIndicator((prev) => {
      if (prev.left === left && prev.width === width) return prev;
      return { left, width };
    });
  }, [active]);

  useLayoutEffect(() => {
    measureIndicator();
    if (hasPositionedOnceRef.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measureIndicator();
      raf2 = requestAnimationFrame(() => {
        if (hasPositionedOnceRef.current) return;
        const btn = tabRefs.current.get(active);
        if (!btn || btn.getBoundingClientRect().width <= 0) return;
        hasPositionedOnceRef.current = true;
        setIndicatorMotionEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [measureIndicator, active, options.length]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div className={cn("mb-4 border-b border-solid border-[#E4E4E7] md:mb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 md:gap-x-3">
        <nav
          ref={navRef}
          className="relative flex min-w-0 flex-1 flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] [scrollbar-width:none] md:gap-5 md:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label={ariaLabel}
        >
          {options.map(({ value, label }) => {
            const isActive = value === active;
            return (
              <button
                key={value}
                ref={(el) => {
                  if (el) tabRefs.current.set(value, el);
                  else tabRefs.current.delete(value);
                }}
                type="button"
                onClick={() => onChange(value)}
                className={`-mb-px shrink-0 cursor-pointer border-b-2 border-solid border-transparent py-2 text-left text-[14px] font-medium leading-6 transition-[color,opacity] duration-100 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2 hover:opacity-80 ${
                  isActive ? "font-semibold text-[#09090B] opacity-100" : "text-[#71717A] opacity-100"
                }`}
              >
                {label}
              </button>
            );
          })}
          <span
            className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#09090B] motion-reduce:transition-none"
            style={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.width > 0 ? 1 : 0,
              transitionProperty: indicatorMotionEnabled ? "left, width" : "none",
              transitionDuration: indicatorMotionEnabled ? `${TAB_MOTION_MS}ms` : "0ms",
              transitionTimingFunction: TAB_MOTION_EASE,
            }}
            aria-hidden
          />
        </nav>
        {trailing ? (
          <div className="hidden shrink-0 md:block md:pb-[9px] md:pl-2">{trailing}</div>
        ) : null}
      </div>
    </div>
  );
}

export function MarketTabs({
  active,
  onChange,
  trailing,
}: {
  active: MarketTab;
  onChange: (tab: MarketTab) => void;
  trailing?: ReactNode;
}) {
  return (
    <UnderlineTabs tabs={tabs} active={active} onChange={onChange} ariaLabel="Markets" trailing={trailing} />
  );
}
