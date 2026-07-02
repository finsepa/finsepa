"use client";

import { useEffect } from "react";

/** Desktop chrome column — topbar, main, watchlist (not the floating bottom nav). */
const MOBILE_SEARCH_ISOLATION_SELECTOR = ".shell-desktop-chrome-column";

/**
 * While mobile bottom-nav search is open, mark page chrome as `inert` so iOS Safari
 * does not treat other inputs as part of the same form (hides the keyboard accessory bar).
 */
export function useMobileBottomNavSearchIsolation(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const node = document.querySelector(MOBILE_SEARCH_ISOLATION_SELECTOR);
    if (!(node instanceof HTMLElement)) return;

    node.inert = true;
    return () => {
      node.inert = false;
    };
  }, [active]);
}
