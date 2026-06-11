import type { MacroCardModel } from "@/components/macro/macro-card";

/** Matches {@link FUNDAMENTALS_CHART_TIME_RANGE_ORDER} on stock Multicharts. */
export type MacroRangeId = "5y" | "10y" | "all";

export const MACRO_RANGE_IDS: MacroRangeId[] = ["5y", "10y", "all"];

export const DEFAULT_MACRO_RANGE: MacroRangeId = "5y";

export const MACRO_RANGE_LABELS: Record<MacroRangeId, string> = {
  "5y": "5Y",
  "10y": "10Y",
  all: "All",
};

export {
  downsampleMacroPointsMonthly,
  formatMacroAxisLabel,
  macroAxisLabelIndices,
  macroChartAxisGranularity,
  macroChartTimeAxisLabels,
  macroRangeUsesMonthlyAxisLabels,
  macroRangeUsesMonthlyPoints,
  prepareMacroPointsForRange,
  sliceMacroPointsByRange,
} from "@/lib/macro/macro-chart-points";
export type { MacroChartPoint } from "@/lib/macro/macro-chart-points";

export function macroModelForWindow(model: MacroCardModel, windowPoints: MacroCardModel["points"]): MacroCardModel {
  if (!windowPoints.length) {
    return { ...model, points: [], latest: null, change: null };
  }
  const latest = windowPoints[windowPoints.length - 1]!;
  const prev = windowPoints.length >= 2 ? windowPoints[windowPoints.length - 2]! : null;
  const abs = prev ? latest.value - prev.value : null;
  const pct = prev && prev.value !== 0 && abs != null ? (abs / Math.abs(prev.value)) * 100 : null;
  return {
    ...model,
    points: windowPoints,
    latest,
    change: abs == null ? null : { abs, pct },
  };
}
