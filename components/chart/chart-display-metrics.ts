import type { StockChartPoint } from "@/lib/market/stock-chart-types";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** User drag selection: P/L from mousedown price → mouseup price (interaction order). */
export type ChartRangeSelection = {
  startPrice: number;
  endPrice: number;
  /** Unix seconds for the bar at the selection end (matches endPrice). */
  endTimeUnix: number;
} | null;

export type ChartHeaderMetrics = {
  displayPrice: number | null;
  displayChangePct: number | null;
  displayChangeAbs: number | null;
  isHovering: boolean;
  selectionActive: boolean;
  /** When set, replaces timeframe label (e.g. "Selected range") */
  periodLabelOverride: string | null;
  /** Unix seconds for the point matching displayPrice (hover / selection end / last bar). */
  displayTimeUnix: number | null;
};

/**
 * Priority: range selection > optional crosshair (Holdings tab only) > period (last vs first).
 * Overview / crypto asset pages pass `crosshairForHeader: null` so the header stays on
 * current price + period P/L; crosshair only drives the chart tooltip there.
 */
export function computeChartHeaderMetrics(
  points: StockChartPoint[],
  selection: ChartRangeSelection,
  crosshairForHeader: { price: number; timeUnix: number } | null = null,
): ChartHeaderMetrics {
  if (!points.length) {
    return {
      displayPrice: null,
      displayChangePct: null,
      displayChangeAbs: null,
      isHovering: false,
      selectionActive: false,
      periodLabelOverride: null,
      displayTimeUnix: null,
    };
  }

  if (
    selection &&
    isFiniteNumber(selection.startPrice) &&
    isFiniteNumber(selection.endPrice) &&
    isFiniteNumber(selection.endTimeUnix)
  ) {
    const abs = selection.endPrice - selection.startPrice;
    const pct = selection.startPrice !== 0 ? (abs / selection.startPrice) * 100 : null;
    return {
      displayPrice: selection.endPrice,
      displayChangePct: pct,
      displayChangeAbs: abs,
      isHovering: false,
      selectionActive: true,
      periodLabelOverride: "Selected range",
      displayTimeUnix: selection.endTimeUnix,
    };
  }

  const first = points[0]!.value;
  if (!isFiniteNumber(first)) {
    return {
      displayPrice: null,
      displayChangePct: null,
      displayChangeAbs: null,
      isHovering: false,
      selectionActive: false,
      periodLabelOverride: null,
      displayTimeUnix: null,
    };
  }

  if (
    crosshairForHeader != null &&
    isFiniteNumber(crosshairForHeader.price) &&
    isFiniteNumber(crosshairForHeader.timeUnix)
  ) {
    const hp = crosshairForHeader.price;
    const abs = hp - first;
    const pct = first !== 0 ? (abs / first) * 100 : null;
    return {
      displayPrice: hp,
      displayChangePct: pct,
      displayChangeAbs: abs,
      isHovering: true,
      selectionActive: false,
      periodLabelOverride: null,
      displayTimeUnix: crosshairForHeader.timeUnix,
    };
  }

  const last = points[points.length - 1]!.value;
  const lastTime = points[points.length - 1]!.time;
  if (!isFiniteNumber(last)) {
    return {
      displayPrice: null,
      displayChangePct: null,
      displayChangeAbs: null,
      isHovering: false,
      selectionActive: false,
      periodLabelOverride: null,
      displayTimeUnix: null,
    };
  }

  const abs = last - first;
  const pct = first !== 0 ? (abs / first) * 100 : null;
  return {
    displayPrice: last,
    displayChangePct: pct,
    displayChangeAbs: abs,
    isHovering: false,
    selectionActive: false,
    periodLabelOverride: null,
    displayTimeUnix: isFiniteNumber(lastTime) ? lastTime : null,
  };
}
