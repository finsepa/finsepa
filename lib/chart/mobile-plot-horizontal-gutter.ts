import type { IChartApi } from "lightweight-charts";

/** Match stock/crypto asset page mobile horizontal padding. */
export const MOBILE_PLOT_HORIZONTAL_GUTTER_PX = 16;

const MOBILE_BREAKPOINT_PX = 640;

export function shouldApplyMobilePlotGutter(containerWidthPx: number): boolean {
  return containerWidthPx > 0 && containerWidthPx < MOBILE_BREAKPOINT_PX;
}

/** Pad the visible logical range so the first/last points are not flush to the plot edge. */
export function applyMobilePlotHorizontalGutter(
  chart: IChartApi,
  containerWidthPx: number,
  options?: { leftPx?: number; rightPx?: number },
): void {
  if (!shouldApplyMobilePlotGutter(containerWidthPx)) return;
  const leftPx = options?.leftPx ?? MOBILE_PLOT_HORIZONTAL_GUTTER_PX;
  const rightPx = options?.rightPx ?? 0;
  const ts = chart.timeScale();
  requestAnimationFrame(() => {
    const lr = ts.getVisibleLogicalRange();
    if (lr == null) return;
    const barSpacing = Math.max(2, ts.options().barSpacing ?? 6);
    ts.setVisibleLogicalRange({
      from: lr.from - leftPx / barSpacing,
      to: lr.to + rightPx / barSpacing,
    });
  });
}

export function fitContentWithMobilePlotGutter(chart: IChartApi, containerWidthPx: number): void {
  chart.timeScale().fitContent();
  applyMobilePlotHorizontalGutter(chart, containerWidthPx);
}
