"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const tabs = ["Stocks", "Crypto", "Indices", "ETF's"] as const;
export type MarketTab = (typeof tabs)[number];

const TAB_MOTION_MS = 280;
const TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** Primary underline tabs — shared by Screener (Stocks/Crypto/Indices) and Portfolio (Overview/Performance/Cash/…). */
export function UnderlineTabs<T extends string>({
  tabs: tabList,
  active,
  onChange,
  ariaLabel,
  trailing,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
  /** Right side of the tab row (e.g. U.S. markets session on `/screener`). */
  trailing?: ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(active);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - navRect.left + nav.scrollLeft,
      width: btnRect.width,
    });
  }, [active]);

  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, tabList]);

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
    <div className="mb-4 border-b border-solid border-[#E4E4E7] md:mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 md:gap-x-3">
        <nav
          ref={navRef}
          className="relative flex min-w-0 flex-1 flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] [scrollbar-width:none] md:gap-5 md:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label={ariaLabel}
        >
          {tabList.map((tab) => {
            const isActive = tab === active;
            return (
              <button
                key={tab}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab, el);
                  else tabRefs.current.delete(tab);
                }}
                type="button"
                onClick={() => onChange(tab)}
                className={`-mb-px shrink-0 cursor-pointer border-b-2 border-solid border-transparent py-2 text-left text-[14px] font-medium leading-6 text-[#09090B] transition-[color,opacity] duration-100 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2 hover:opacity-80 ${
                  isActive ? "opacity-100" : "opacity-70"
                }`}
              >
                {tab}
              </button>
            );
          })}
          <span
            className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#09090B] motion-reduce:transition-none"
            style={{
              left: indicator.left,
              width: indicator.width,
              transitionProperty: "left, width",
              transitionDuration: `${TAB_MOTION_MS}ms`,
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
