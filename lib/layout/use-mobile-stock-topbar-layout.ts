"use client";

import { useLayoutEffect } from "react";

/** Synced with `globals.css` — taller fixed topbar when stock tabs live in the chrome row. */
export const MOBILE_STOCK_TOPBAR_CLASS = "mobile-stock-topbar";

/** Server-rendered on stock routes — sets `--mobile-topbar-offset` before hydration. */
export const MOBILE_STOCK_TOPBAR_OFFSET_CLASS = "mobile-stock-topbar-offset";

function syncMobileStockTopbarClass(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_STOCK_TOPBAR_CLASS, active);
}

/** Expands `--mobile-topbar-offset` on mobile while stock section tabs are in the fixed top bar. */
export function useMobileStockTopbarLayout(active: boolean): void {
  useLayoutEffect(() => {
    syncMobileStockTopbarClass(active);
    return () => syncMobileStockTopbarClass(false);
  }, [active]);
}
