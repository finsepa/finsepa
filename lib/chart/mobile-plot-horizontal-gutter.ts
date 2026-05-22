import type { IChartApi } from "lightweight-charts";

/** Legacy default when callers pass explicit side inset; mobile overview charts use 0 (full width). */
export const MOBILE_PLOT_HORIZONTAL_GUTTER_PX = 0;

const MOBILE_BREAKPOINT_PX = 640;

export function shouldApplyMobilePlotGutter(containerWidthPx: number): boolean {
  return containerWidthPx > 0 && containerWidthPx < MOBILE_BREAKPOINT_PX;
}

/** Narrow viewports: hide Y-axis tick ladder and series last-value badge on the right. */
export function shouldHideMobileYAxisLabels(containerWidthPx: number): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(max-width: 767px)").matches) return true;
    if (window.matchMedia("(pointer: coarse)").matches && containerWidthPx > 0 && containerWidthPx < 1024) {
      return true;
    }
  }
  return shouldApplyMobilePlotGutter(containerWidthPx);
}

/** Mobile overview: collapse the right price scale so the plot uses the full container width. */
export function mobileRightPriceScaleOptions(containerWidthPx: number) {
  const hideYAxisLabels = shouldHideMobileYAxisLabels(containerWidthPx);
  if (hideYAxisLabels) {
    return {
      visible: false,
      borderVisible: false,
      /** Tighter plot bottom on mobile (custom axis row sits below the pane). */
      scaleMargins: { top: 0.12, bottom: 0.048 },
    };
  }
  return {
    visible: true,
    borderVisible: false,
    scaleMargins: { top: 0.12, bottom: 0.08 },
  };
}

export function mobileLeftPriceScaleOptions(containerWidthPx: number) {
  if (!shouldHideMobileYAxisLabels(containerWidthPx)) return undefined;
  return {
    visible: false,
    borderVisible: false,
  };
}

/** Apply both price scales for overview / compare charts (call from createChart + applyOptions). */
export function mobileOverviewChartScaleOptions(containerWidthPx: number) {
  const left = mobileLeftPriceScaleOptions(containerWidthPx);
  return {
    rightPriceScale: mobileRightPriceScaleOptions(containerWidthPx),
    ...(left ? { leftPriceScale: left } : {}),
  };
}

/** Pin first/last points to pane edges on mobile (no default rightOffset gap). */
export function mobileTimeScaleOptions(containerWidthPx: number) {
  const mobile = shouldApplyMobilePlotGutter(containerWidthPx);
  if (!mobile) {
    return { fixLeftEdge: false, fixRightEdge: false };
  }
  return {
    fixLeftEdge: true,
    fixRightEdge: true,
    rightOffset: 0,
  };
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
  if (leftPx <= 0 && rightPx <= 0) return;
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

/** Fit series to plot width on mobile — snap logical range 0…n−1 with no trailing whitespace. */
export function fitContentWithMobilePlotGutter(
  chart: IChartApi,
  containerWidthPx: number,
  logicalPointCount = 0,
): void {
  const ts = chart.timeScale();
  if (!shouldApplyMobilePlotGutter(containerWidthPx) || logicalPointCount < 1) {
    ts.fitContent();
    return;
  }

  const lastIdx = logicalPointCount - 1;
  ts.applyOptions(mobileTimeScaleOptions(containerWidthPx));

  const layout = (attempt = 0) => {
    requestAnimationFrame(() => {
      const plotW = ts.width();
      if (plotW < 12 && attempt < 12) {
        layout(attempt + 1);
        return;
      }
      if (plotW < 12) return;

      // Visible range is logical indices 0…lastIdx (n−1 bars apart). Spacing must be
      // plotW / lastIdx, not plotW / n, or the last point stops one bar short of the edge.
      const spacing = lastIdx > 0 ? plotW / lastIdx : plotW;
      ts.applyOptions({
        barSpacing: Math.max(0.5, spacing),
        minBarSpacing: 0.5,
      });
      ts.setVisibleLogicalRange({ from: 0, to: lastIdx });

      if (attempt === 0) {
        layout(1);
      }
    });
  };

  layout();
}
