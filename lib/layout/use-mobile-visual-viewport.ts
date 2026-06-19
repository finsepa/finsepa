"use client";

import { useLayoutEffect, useState } from "react";

const MOBILE_VISUAL_VIEWPORT_HEIGHT_VAR = "--mobile-visual-viewport-height";

export type MobileVisualViewportMetrics = {
  /** Layout viewport height minus visible visual viewport (keyboard + browser chrome). */
  keyboardInsetPx: number;
  /** Visible viewport height in CSS pixels. */
  heightPx: number;
  /** Visual viewport offset from the top of the layout viewport. */
  offsetTopPx: number;
};

const IDLE_METRICS: MobileVisualViewportMetrics = {
  keyboardInsetPx: 0,
  heightPx: 0,
  offsetTopPx: 0,
};

function readMobileVisualViewportMetrics(): MobileVisualViewportMetrics {
  if (typeof window === "undefined") return IDLE_METRICS;
  const ih = window.innerHeight;
  const vv = window.visualViewport;
  if (!vv) {
    return { keyboardInsetPx: 0, heightPx: ih, offsetTopPx: 0 };
  }
  return {
    keyboardInsetPx: Math.max(0, Math.round(ih - vv.offsetTop - vv.height)),
    heightPx: Math.round(vv.height),
    offsetTopPx: Math.round(vv.offsetTop),
  };
}

function syncMobileVisualViewportHeightVar(heightPx: number, active: boolean) {
  if (typeof document === "undefined") return;
  if (!active || heightPx <= 0) {
    document.documentElement.style.removeProperty(MOBILE_VISUAL_VIEWPORT_HEIGHT_VAR);
    return;
  }
  document.documentElement.style.setProperty(MOBILE_VISUAL_VIEWPORT_HEIGHT_VAR, `${heightPx}px`);
}

/** Tracks iOS/Android visual viewport while mobile overlays (search, etc.) are open. */
export function useMobileVisualViewport(active: boolean): MobileVisualViewportMetrics {
  const [metrics, setMetrics] = useState<MobileVisualViewportMetrics>(IDLE_METRICS);

  useLayoutEffect(() => {
    if (!active) {
      setMetrics(IDLE_METRICS);
      syncMobileVisualViewportHeightVar(0, false);
      return;
    }

    const update = () => {
      const next = readMobileVisualViewportMetrics();
      setMetrics(next);
      syncMobileVisualViewportHeightVar(next.heightPx, true);
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      syncMobileVisualViewportHeightVar(0, false);
    };
  }, [active]);

  return metrics;
}
