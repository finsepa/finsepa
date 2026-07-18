"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  horizontalOverlayScrollbarActiveClassName,
  horizontalOverlayScrollbarClassName,
} from "@/components/design-system/dropdown-menu-styles";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { STOCK_DETAIL_TAB_ITEMS } from "@/lib/stock/stock-detail-tab-items";
import { ETF_STOCK_DETAIL_TAB_IDS } from "@/lib/stock/stock-etf";
import { cn } from "@/lib/utils";

export type { StockDetailTabId };

const TAB_MOTION_MS = 280;
const TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
const SCROLLBAR_IDLE_MS = 900;

/** Underline tabs with sliding indicator — desktop stock asset page (mobile uses fixed top bar). */
export function StockDetailTabNav({
  activeTab,
  onTabChange,
  onTabIntent,
  isEtf = false,
  sticky = true,
}: {
  activeTab: StockDetailTabId;
  onTabChange: (tab: StockDetailTabId) => void;
  /** Hover/focus prefetch before the tab panel mounts (e.g. earnings API). */
  onTabIntent?: (tab: StockDetailTabId) => void;
  /** When true, only Overview and Portfolio tabs are shown. */
  isEtf?: boolean;
  /** Off on Financials so the statement year row can stick to the top of the scroll area. */
  sticky?: boolean;
}) {
  const tabs = useMemo(
    () =>
      isEtf
        ? STOCK_DETAIL_TAB_ITEMS.filter((t) => (ETF_STOCK_DETAIL_TAB_IDS as readonly string[]).includes(t.id))
        : STOCK_DETAIL_TAB_ITEMS,
    [isEtf],
  );

  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<StockDetailTabId, HTMLButtonElement>());
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [scrollbarVisible, setScrollbarVisible] = useState(false);

  const revealScrollbar = useCallback(() => {
    setScrollbarVisible(true);
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => setScrollbarVisible(false), SCROLLBAR_IDLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    },
    [],
  );

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(activeTab);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - navRect.left + nav.scrollLeft;
    const width = btnRect.width;
    setIndicator((prev) => {
      if (Math.abs(prev.left - left) < 0.5 && Math.abs(prev.width - width) < 0.5) return prev;
      return { left, width };
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, isEtf, activeTab]);

  useLayoutEffect(() => {
    const btn = tabRefs.current.get(activeTab);
    btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measureIndicator();
  }, [activeTab, measureIndicator]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    const onScroll = () => {
      revealScrollbar();
      measureIndicator();
    };
    nav.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      nav.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator, revealScrollbar]);

  const shellClassName =
    "max-md:bg-[#FAFAFA] bg-white max-md:mx-0 max-md:-mt-2 max-md:pt-0 max-md:pb-1 sm:-mx-9 sm:-mt-5 sm:px-9 sm:pt-2 sm:pb-2";

  return (
    <div className={sticky ? `sticky top-0 z-40 max-md:top-[var(--mobile-topbar-offset)] ${shellClassName}` : shellClassName}>
      <div className="min-w-0 border-b border-solid border-[#E4E4E7]">
        <nav
          ref={navRef}
          className={cn(
            "relative -mx-1 flex min-w-0 flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-px sm:mx-0 sm:gap-5",
            "[-webkit-overflow-scrolling:touch]",
            horizontalOverlayScrollbarClassName,
            scrollbarVisible && horizontalOverlayScrollbarActiveClassName,
          )}
          aria-label="Stock sections"
          onWheel={revealScrollbar}
          onTouchMove={revealScrollbar}
        >
          {tabs.map(({ id, label }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                ref={(el) => {
                  if (el) tabRefs.current.set(id, el);
                  else tabRefs.current.delete(id);
                }}
                type="button"
                onClick={() => onTabChange(id)}
                onPointerEnter={() => onTabIntent?.(id)}
                onFocus={() => onTabIntent?.(id)}
                className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 border-solid border-transparent py-2 text-left text-[14px] font-medium leading-6 text-[#0F0F0F] transition-[color,opacity] duration-100 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2 hover:opacity-80 ${
                  isActive ? "font-semibold opacity-100" : "opacity-70"
                }`}
              >
                {label}
              </button>
            );
          })}
          <span
            className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#0F0F0F] motion-reduce:transition-none"
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
      </div>
    </div>
  );
}

export function StockDetailTabPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-2 pt-1">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#0F0F0F]">{title}</h2>
      <p className="max-w-md text-[14px] leading-6 text-[#71717A]">{message}</p>
    </div>
  );
}
