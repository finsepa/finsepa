"use client";

import { useEffect, useRef, useState } from "react";

const MOBILE_SHELL_MQ = "(max-width: 767px)";
const SCROLL_DELTA_PX = 6;
const TOP_ALWAYS_SHOW_PX = 16;

/** Synced with `globals.css` — docks back-to-top FAB where the nav pill sits. */
export const MOBILE_BOTTOM_NAV_SCROLL_HIDDEN_CLASS = "mobile-bottom-nav-scroll-hidden";

function syncMobileBottomNavScrollHiddenClass(hidden: boolean, mobile: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_BOTTOM_NAV_SCROLL_HIDDEN_CLASS, mobile && hidden);
}

/**
 * Hides the mobile bottom nav while scrolling down; shows again on scroll up.
 * Uses `window` scroll (document scroll shell on mobile).
 */
export function useMobileBottomNavScrollHide(enabled: boolean, resetKey = ""): boolean {
  const [hidden, setHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    setHidden(false);
    syncMobileBottomNavScrollHiddenClass(false, false);
    if (typeof window !== "undefined") lastScrollYRef.current = window.scrollY;
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      syncMobileBottomNavScrollHiddenClass(false, false);
      return;
    }

    const mq = window.matchMedia(MOBILE_SHELL_MQ);
    const applyHidden = (next: boolean) => {
      setHidden(next);
      syncMobileBottomNavScrollHiddenClass(next, mq.matches);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!mq.matches) {
          applyHidden(false);
          return;
        }
        const y = window.scrollY;
        if (y <= TOP_ALWAYS_SHOW_PX) {
          applyHidden(false);
          lastScrollYRef.current = y;
          return;
        }
        const delta = y - lastScrollYRef.current;
        if (delta > SCROLL_DELTA_PX) applyHidden(true);
        else if (delta < -SCROLL_DELTA_PX) applyHidden(false);
        lastScrollYRef.current = y;
      });
    };

    const onMqChange = () => {
      if (!mq.matches) applyHidden(false);
      lastScrollYRef.current = window.scrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onMqChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMqChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncMobileBottomNavScrollHiddenClass(false, false);
    };
  }, [enabled]);

  return hidden;
}

/** True when mobile bottom nav is scroll-hidden (scroll down); false on scroll up / top / desktop. */
export function useMobileBottomNavScrollHidden(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MQ);
    const read = () => {
      if (!mq.matches) {
        setHidden(false);
        return;
      }
      setHidden(document.documentElement.classList.contains(MOBILE_BOTTOM_NAV_SCROLL_HIDDEN_CLASS));
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    mq.addEventListener("change", read);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", read);
    };
  }, []);

  return hidden;
}
