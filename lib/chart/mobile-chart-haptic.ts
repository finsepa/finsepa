import type { IChartApi } from "lightweight-charts";

import { pointAtChartX } from "@/components/chart/chart-selection-utils";
import {
  attachPassThroughIosHapticOverlay,
  isAppleMobileDevice,
  isTouchDeviceNow,
  triggerHostHapticOverlayClick,
  triggerMobileChartHaptic,
} from "@/lib/haptic";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

export type MobilePriceChartHapticOptions = {
  getChart: () => IChartApi | null;
  getPoints: () => StockChartPoint[];
};

/**
 * Mobile price-chart haptics: first tap + ticks while scrubbing between data points.
 * iOS 26.5+ uses a pass-through switch overlay (same pattern as bottom nav).
 */
export function attachMobilePriceChartHaptics(
  host: HTMLElement,
  options: MobilePriceChartHapticOptions,
): () => void {
  if (!isTouchDeviceNow()) return () => {};

  const cleanups: (() => void)[] = [];
  let scrubbing = false;
  let lastBarTime: number | null = null;

  const barAtClientX = (clientX: number) => {
    const chart = options.getChart();
    if (!chart) return null;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    return pointAtChartX(chart, options.getPoints(), x);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    scrubbing = true;
    lastBarTime = null;
    const bar = barAtClientX(event.clientX);
    if (!bar) return;
    lastBarTime = bar.time;
    // iOS first tap is handled by the pass-through switch overlay.
    if (!isAppleMobileDevice()) triggerMobileChartHaptic();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!scrubbing || event.pointerType === "mouse" || event.buttons === 0) return;
    const bar = barAtClientX(event.clientX);
    if (!bar) return;
    if (lastBarTime != null && bar.time !== lastBarTime) {
      lastBarTime = bar.time;
      if (isAppleMobileDevice()) triggerHostHapticOverlayClick(host);
      else triggerMobileChartHaptic();
    } else if (lastBarTime == null) {
      lastBarTime = bar.time;
    }
  };

  const endScrub = () => {
    scrubbing = false;
    lastBarTime = null;
  };

  if (isAppleMobileDevice()) {
    cleanups.push(attachPassThroughIosHapticOverlay(host));
  }

  const capture = { capture: true };
  host.addEventListener("pointerdown", onPointerDown, capture);
  host.addEventListener("pointermove", onPointerMove, capture);
  host.addEventListener("pointerup", endScrub, capture);
  host.addEventListener("pointercancel", endScrub, capture);

  cleanups.push(() => {
    host.removeEventListener("pointerdown", onPointerDown, capture);
    host.removeEventListener("pointermove", onPointerMove, capture);
    host.removeEventListener("pointerup", endScrub, capture);
    host.removeEventListener("pointercancel", endScrub, capture);
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
