"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MOBILE_SHELL_MQ = "(max-width: 767px)";
const SCROLL_DELTA_PX = 6;
const TOP_ALWAYS_SHOW_PX = 16;

/** Synced with `globals.css` — compact bottom nav (icon-only) while scrolling down. */
export const MOBILE_BOTTOM_NAV_SCROLL_COMPACT_CLASS = "mobile-bottom-nav-scroll-compact";

function syncMobileBottomNavScrollCompactClass(compact: boolean, mobile: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_BOTTOM_NAV_SCROLL_COMPACT_CLASS, mobile && compact);
}

/**
 * Compacts the mobile bottom nav while scrolling down (icon-only); expands again on scroll up.
 * Uses `window` scroll (document scroll shell on mobile).
 */
export function useMobileBottomNavScrollHide(enabled: boolean): boolean {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      syncMobileBottomNavScrollCompactClass(false, false);
      return;
    }

    const mq = window.matchMedia(MOBILE_SHELL_MQ);
    let raf2 = 0;

    const sync = () => {
      const y = window.scrollY;
      lastScrollYRef.current = y;
      const next = mq.matches && y > TOP_ALWAYS_SHOW_PX;
      setCompact(next);
      syncMobileBottomNavScrollCompactClass(next, mq.matches);
    };

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(sync);
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [pathname, enabled]);

  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      syncMobileBottomNavScrollCompactClass(false, false);
      return;
    }

    const mq = window.matchMedia(MOBILE_SHELL_MQ);
    const applyCompact = (next: boolean) => {
      setCompact(next);
      syncMobileBottomNavScrollCompactClass(next, mq.matches);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!mq.matches) {
          applyCompact(false);
          return;
        }
        const y = window.scrollY;
        if (y <= TOP_ALWAYS_SHOW_PX) {
          applyCompact(false);
          lastScrollYRef.current = y;
          return;
        }
        const delta = y - lastScrollYRef.current;
        if (delta > SCROLL_DELTA_PX) applyCompact(true);
        else if (delta < -SCROLL_DELTA_PX) applyCompact(false);
        lastScrollYRef.current = y;
      });
    };

    const onMqChange = () => {
      if (!mq.matches) applyCompact(false);
      lastScrollYRef.current = window.scrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onMqChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMqChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncMobileBottomNavScrollCompactClass(false, false);
    };
  }, [enabled]);

  return compact;
}
