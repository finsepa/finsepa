import type { MacroCardModel } from "@/components/macro/macro-card";

/** Long-history Macro charts (valuation, rates, inflation, economy, fear & greed). */
export type MacroLongRangeId = "5y" | "10y" | "20y" | "all";

/** Short daily series (BTC ETF net flows). */
export type MacroDailyRangeId = "1m" | "ytd" | "1y" | "all";

export type MacroRangeId = MacroLongRangeId | MacroDailyRangeId;

export const MACRO_RANGE_IDS: MacroLongRangeId[] = ["5y", "10y", "20y", "all"];

export const DEFAULT_MACRO_RANGE: MacroLongRangeId = "20y";

export const BTC_ETF_FLOW_RANGE_IDS: MacroDailyRangeId[] = ["1m", "ytd", "1y", "all"];

export const DEFAULT_BTC_ETF_FLOW_RANGE: MacroDailyRangeId = "ytd";

export const MACRO_RANGE_LABELS: Record<MacroRangeId, string> = {
  "5y": "5Y",
  "10y": "10Y",
  "20y": "20Y",
  "1m": "1M",
  ytd: "YTD",
  "1y": "1Y",
  all: "All",
};

export function isBtcEtfFlowRangeId(id: string): id is MacroDailyRangeId {
  return (BTC_ETF_FLOW_RANGE_IDS as readonly string[]).includes(id);
}

export function isMacroLongRangeId(id: string): id is MacroLongRangeId {
  return (MACRO_RANGE_IDS as readonly string[]).includes(id);
}

export {
  aggregateMacroPointsMonthlySum,
  aggregateMacroPointsWeeklySum,
  downsampleMacroPointsMonthly,
  formatMacroAxisLabel,
  macroAxisLabelIndices,
  macroAxisLabelIndicesForTimes,
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
