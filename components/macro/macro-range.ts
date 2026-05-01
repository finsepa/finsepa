import type { MacroCardModel } from "@/components/macro/macro-card";

export type MacroRangeId = "1y" | "2y" | "5y" | "10y" | "20y" | "50y" | "all";

export const MACRO_RANGE_IDS: MacroRangeId[] = ["1y", "2y", "5y", "10y", "20y", "50y", "all"];

export const DEFAULT_MACRO_RANGE: MacroRangeId = "20y";

export const MACRO_RANGE_LABELS: Record<MacroRangeId, string> = {
  "1y": "1Y",
  "2y": "2Y",
  "5y": "5Y",
  "10y": "10Y",
  "20y": "20Y",
  "50y": "50Y",
  all: "All",
};

const RANGE_YEARS: Record<Exclude<MacroRangeId, "all">, number> = {
  "1y": 1,
  "2y": 2,
  "5y": 5,
  "10y": 10,
  "20y": 20,
  "50y": 50,
};

export function sliceMacroPointsByRange(
  points: Array<{ time: string; value: number }>,
  rangeId: MacroRangeId,
): Array<{ time: string; value: number }> {
  if (rangeId === "all" || points.length === 0) return points;
  const years = RANGE_YEARS[rangeId];
  const last = points[points.length - 1]!.time;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last);
  if (!m) return points;
  const ey = Number(m[1]);
  const em = Number(m[2]);
  const ed = Number(m[3]);
  const startMs = Date.UTC(ey - years, em - 1, ed);
  const startStr = new Date(startMs).toISOString().slice(0, 10);
  return points.filter((p) => p.time >= startStr);
}

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
