import type { StockChartPoint } from "@/lib/market/stock-chart-types";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** User drag selection: P/L from earlier bar → later bar (chronological). */
export type ChartRangeSelection = {
  startPrice: number;
  endPrice: number;
  /** Unix seconds for the selection start bar. */
  startTimeUnix: number;
  /** Unix seconds for the selection end bar. */
  endTimeUnix: number;
} | null;

export type ChartHeaderMetrics = {
  displayPrice: number | null;
  /** Period move: first bar → latest bar in the loaded range (matches headline price). */
  displayChangePct: number | null;
  displayChangeAbs: number | null;
  /** When a drag selection exists: move over the selected window only. */
  selectionChangeAbs: number | null;
  selectionChangePct: number | null;
  isHovering: boolean;
  selectionActive: boolean;
  /** When set, replaces timeframe label (e.g. "Selected range") */
  periodLabelOverride: string | null;
  /** Unix seconds for the point matching displayPrice (crosshair / last bar; headline stays on last bar when a range is selected). */
  displayTimeUnix: number | null;
};

/**
 * Headline `displayPrice` is always the latest bar when points exist.
 * `displayChange*` = period (first → last). When a range is selected, `selectionChange*` holds
 * the selected window; optional crosshair (Holdings) overrides headline to the hovered bar.
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
      selectionChangeAbs: null,
      selectionChangePct: null,
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
    isFiniteNumber(selection.startTimeUnix) &&
    isFiniteNumber(selection.endTimeUnix)
  ) {
    const last = points[points.length - 1]!.value;
    const lastTime = points[points.length - 1]!.time;
    if (!isFiniteNumber(last)) {
      return {
        displayPrice: null,
        displayChangePct: null,
        displayChangeAbs: null,
        selectionChangeAbs: null,
        selectionChangePct: null,
        isHovering: false,
        selectionActive: false,
        periodLabelOverride: null,
        displayTimeUnix: null,
      };
    }
    const first = points[0]!.value;
    if (!isFiniteNumber(first)) {
      return {
        displayPrice: null,
        displayChangePct: null,
        displayChangeAbs: null,
        selectionChangeAbs: null,
        selectionChangePct: null,
        isHovering: false,
        selectionActive: false,
        periodLabelOverride: null,
        displayTimeUnix: null,
      };
    }
    const periodAbs = last - first;
    const periodPct = first !== 0 ? (periodAbs / first) * 100 : null;
    const selAbs = selection.endPrice - selection.startPrice;
    const selPct = selection.startPrice !== 0 ? (selAbs / selection.startPrice) * 100 : null;
    return {
      displayPrice: last,
      displayChangePct: periodPct,
      displayChangeAbs: periodAbs,
      selectionChangeAbs: selAbs,
      selectionChangePct: selPct,
      isHovering: false,
      selectionActive: true,
      periodLabelOverride: null,
      displayTimeUnix: isFiniteNumber(lastTime) ? lastTime : null,
    };
  }

  const first = points[0]!.value;
  if (!isFiniteNumber(first)) {
    return {
      displayPrice: null,
      displayChangePct: null,
      displayChangeAbs: null,
      selectionChangeAbs: null,
      selectionChangePct: null,
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
      selectionChangeAbs: null,
      selectionChangePct: null,
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
      selectionChangeAbs: null,
      selectionChangePct: null,
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
    selectionChangeAbs: null,
    selectionChangePct: null,
    isHovering: false,
    selectionActive: false,
    periodLabelOverride: null,
    displayTimeUnix: isFiniteNumber(lastTime) ? lastTime : null,
  };
}
