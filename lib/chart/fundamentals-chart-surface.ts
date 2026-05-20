import { LineStyle, type IChartApi, type IPriceLine, type ISeriesApi } from "lightweight-charts";

/** Column hover band — Multicharts, Earnings, Charting. */
export const FUNDAMENTALS_CHART_HOVER_BAND_BG = "rgba(59, 130, 246, 0.14)";

export const FUNDAMENTALS_CHART_GRID_LINE_COLOR = "#F4F4F5";

export const FUNDAMENTALS_CHART_TOOLTIP_CLASS =
  "pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 pr-3.5 text-left shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]";

export const FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT = 6;

export const HIDE_NATIVE_Y_AXIS_TICK_LABELS = (priceValue: readonly number[]) => priceValue.map(() => "");

/** `anchorX` in px relative to plot left edge. */
export function computeFundamentalsChartTooltipPlacement(
  focusX: number,
  containerWidthPx: number,
): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerWidthPx - 2 * pad));

  if (focusX - gap - estW >= pad) {
    return { anchorX: focusX, side: "left" };
  }

  let anchorX = focusX;
  if (anchorX + gap + estW > containerWidthPx - pad) {
    anchorX = containerWidthPx - pad - gap - estW;
  }
  anchorX = Math.max(pad, anchorX);
  return { anchorX, side: "right" };
}

const Y_AXIS_LABEL_ONLY = {
  color: "transparent",
  lineWidth: 1,
  lineStyle: LineStyle.Solid,
  axisLabelVisible: true,
  axisLabelColor: "#ffffff",
  axisLabelTextColor: "#71717A",
  lineVisible: false,
  title: "",
} as const;

type YAxisSeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | ISeriesApi<"Area"> | ISeriesApi<"Baseline">;

export function removeFundamentalsChartYAxisTickLabels(
  series: YAxisSeries | null,
  ticksRef: { current: IPriceLine[] },
) {
  if (!series) {
    ticksRef.current = [];
    return;
  }
  for (const line of ticksRef.current) {
    try {
      series.removePriceLine(line);
    } catch {
      /* ignore */
    }
  }
  ticksRef.current = [];
}

/** Evenly spaced right-axis numbers without extra grid lines (Multicharts-style). */
export function syncFundamentalsChartYAxisTickLabels(
  chart: IChartApi,
  series: YAxisSeries,
  ticksRef: { current: IPriceLine[] },
  tickCount: number = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT,
) {
  const h = chart.paneSize(0).height;
  if (!Number.isFinite(h) || h <= 0 || tickCount < 2) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  const topPrice = series.coordinateToPrice(0);
  const bottomPrice = series.coordinateToPrice(h);
  if (topPrice == null || bottomPrice == null) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  let top = topPrice as number;
  let bottom = bottomPrice as number;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }
  if (top < bottom) {
    const swap = top;
    top = bottom;
    bottom = swap;
  }

  const span = top - bottom;
  if (span <= 0) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  const prices: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    prices.push(bottom + (span * i) / (tickCount - 1));
  }

  while (ticksRef.current.length > prices.length) {
    const line = ticksRef.current.pop();
    if (line) {
      try {
        series.removePriceLine(line);
      } catch {
        /* ignore */
      }
    }
  }

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]!;
    const existing = ticksRef.current[i];
    if (existing) {
      existing.applyOptions({ price, ...Y_AXIS_LABEL_ONLY });
    } else {
      ticksRef.current.push(series.createPriceLine({ price, ...Y_AXIS_LABEL_ONLY }));
    }
  }
}
