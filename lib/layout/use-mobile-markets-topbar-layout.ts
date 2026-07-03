"use client";

import { useEffect } from "react";

/** Synced with `globals.css` — taller fixed topbar when market tabs live in the chrome row. */
export const MOBILE_MARKETS_TOPBAR_CLASS = "mobile-markets-topbar";

function syncMobileMarketsTopbarClass(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_MARKETS_TOPBAR_CLASS, active);
}

/** Expands `--mobile-topbar-offset` on mobile while the Markets tab row is in the fixed top bar. */
export function useMobileMarketsTopbarLayout(active: boolean): void {
  useEffect(() => {
    syncMobileMarketsTopbarClass(active);
    return () => syncMobileMarketsTopbarClass(false);
  }, [active]);
}
