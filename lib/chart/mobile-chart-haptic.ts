import type { IChartApi } from "lightweight-charts";

import { pointAtChartX } from "@/components/chart/chart-selection-utils";
import { isTouchDeviceNow, triggerMobileChartHaptic } from "@/lib/haptic";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

export type MobilePriceChartHapticOptions = {
  getChart: () => IChartApi | null;
  getPoints: () => StockChartPoint[];
  /** Drive mobile crosshair + tooltip while the finger moves (does not block chart touches). */
  onScrub?: (clientX: number, clientY: number) => void;
  onScrubEnd?: () => void;
};

/**
 * Mobile price-chart touch scrub: haptics + optional crosshair callback.
 * Does not install a blocking overlay — chart canvas keeps receiving real touches.
 */
export function attachMobilePriceChartHaptics(
  host: HTMLElement,
  options: MobilePriceChartHapticOptions,
): () => void {
  if (!isTouchDeviceNow()) return () => {};

  let scrubbing = false;
  let lastBarTime: number | null = null;

  const barAtClientX = (clientX: number) => {
    const chart = options.getChart();
    if (!chart) return null;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    return pointAtChartX(chart, options.getPoints(), x);
  };

  const emitScrub = (event: PointerEvent) => {
    options.onScrub?.(event.clientX, event.clientY);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    scrubbing = true;
    lastBarTime = null;
    emitScrub(event);
    const bar = barAtClientX(event.clientX);
    if (!bar) return;
    lastBarTime = bar.time;
    triggerMobileChartHaptic();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!scrubbing || event.pointerType === "mouse") return;
    if (event.pointerType === "mouse" && event.buttons === 0) return;
    emitScrub(event);
    const bar = barAtClientX(event.clientX);
    if (!bar) return;
    if (lastBarTime != null && bar.time !== lastBarTime) {
      lastBarTime = bar.time;
      triggerMobileChartHaptic();
    } else if (lastBarTime == null) {
      lastBarTime = bar.time;
    }
  };

  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    lastBarTime = null;
    options.onScrubEnd?.();
  };

  const capture = { capture: true, passive: true } as const;
  host.addEventListener("pointerdown", onPointerDown, capture);
  host.addEventListener("pointermove", onPointerMove, capture);
  host.addEventListener("pointerup", endScrub, capture);
  host.addEventListener("pointercancel", endScrub, capture);

  return () => {
    host.removeEventListener("pointerdown", onPointerDown, capture);
    host.removeEventListener("pointermove", onPointerMove, capture);
    host.removeEventListener("pointerup", endScrub, capture);
    host.removeEventListener("pointercancel", endScrub, capture);
  };
}
