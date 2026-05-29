import type { MacroRangeId } from "@/components/macro/macro-range";

export type MacroChartPoint = { time: string; value: number };

const RANGE_YEARS: Record<Exclude<MacroRangeId, "all">, number> = {
  "1y": 1,
  "2y": 2,
  "5y": 5,
  "10y": 10,
};

/** Calendar slice: last observation minus N years (inclusive). */
export function sliceMacroPointsByRange(
  points: readonly MacroChartPoint[],
  rangeId: MacroRangeId,
): MacroChartPoint[] {
  if (rangeId === "all" || points.length === 0) return [...points];
  const years = RANGE_YEARS[rangeId];
  if (years == null || !Number.isFinite(years) || years <= 0) return [...points];

  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const last = sorted[sorted.length - 1]!.time.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last);
  if (!m) return sorted;

  const ey = Number(m[1]);
  const em = Number(m[2]);
  const ed = Number(m[3]);
  if (!Number.isFinite(ey) || !Number.isFinite(em) || !Number.isFinite(ed)) return sorted;

  const startMs = Date.UTC(ey - years, em - 1, ed);
  const startStr = new Date(startMs).toISOString().slice(0, 10);
  return sorted.filter((p) => p.time.slice(0, 10) >= startStr);
}

/** Last observation in each calendar month — keeps 10Y daily treasury usable on bar charts. */
export function downsampleMacroPointsMonthly(points: readonly MacroChartPoint[]): MacroChartPoint[] {
  if (points.length <= 1) return [...points];
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const byMonth = new Map<string, MacroChartPoint>();
  for (const p of sorted) {
    const monthKey = p.time.trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    byMonth.set(monthKey, { time: p.time.slice(0, 10), value: p.value });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.time.localeCompare(b.time));
}

/** 1Y–5Y charts use one point per calendar month (when source data allows). */
export function macroRangeUsesMonthlyPoints(rangeId: MacroRangeId): boolean {
  return rangeId === "1y" || rangeId === "2y" || rangeId === "5y";
}

export function macroRangeUsesMonthlyAxisLabels(rangeId: MacroRangeId): boolean {
  return macroRangeUsesMonthlyPoints(rangeId);
}

function shouldDownsampleForRange(pointCount: number, rangeId: MacroRangeId): boolean {
  if (pointCount <= 72) return false;
  if (rangeId === "all") return pointCount > 180;
  const years = RANGE_YEARS[rangeId as Exclude<MacroRangeId, "all">];
  if (!years) return pointCount > 180;
  return pointCount > years * 40;
}

/** Slice to the selected range, then thin dense daily series for chart readability. */
export function prepareMacroPointsForRange(
  points: readonly MacroChartPoint[],
  rangeId: MacroRangeId,
): MacroChartPoint[] {
  const sliced = sliceMacroPointsByRange(points, rangeId);
  if (macroRangeUsesMonthlyPoints(rangeId)) {
    const monthly = downsampleMacroPointsMonthly(sliced);
    return monthly.length > 0 ? monthly : sliced;
  }
  if (shouldDownsampleForRange(sliced.length, rangeId)) {
    return downsampleMacroPointsMonthly(sliced);
  }
  return sliced;
}

/** X-axis label granularity for macro bar / line cards. */
export function macroChartAxisGranularity(
  rangeId: MacroRangeId,
  firstTime: string,
  lastTime: string,
): "month" | "year" {
  if (macroRangeUsesMonthlyAxisLabels(rangeId)) return "month";
  const y0 = parseInt(firstTime.slice(0, 4), 10);
  const y1 = parseInt(lastTime.slice(0, 4), 10);
  if (Number.isFinite(y0) && Number.isFinite(y1) && y1 - y0 <= 0) return "month";
  return "year";
}

export function formatMacroAxisLabel(time: string, granularity: "month" | "year"): string {
  const t = time.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t.slice(0, 4);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (!Number.isFinite(d.getTime())) return t.slice(0, 4);
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(y);
}

/** Indices to label on dense x-axes (e.g. ~8 ticks across 60 monthly bars). */
export function macroAxisLabelIndices(pointCount: number, maxLabels = 8): number[] {
  if (pointCount <= 0) return [];
  if (pointCount <= maxLabels) return Array.from({ length: pointCount }, (_, i) => i);
  const step = Math.max(1, Math.ceil(pointCount / maxLabels));
  const out: number[] = [];
  for (let i = 0; i < pointCount; i += step) out.push(i);
  if (out[out.length - 1] !== pointCount - 1) out.push(pointCount - 1);
  return out;
}

/** Bottom time-axis strip labels (area / line card footer). */
export function macroChartTimeAxisLabels(
  points: readonly { time: string }[],
  rangeId: MacroRangeId,
  slotCount = 6,
): string[] {
  if (!points.length) return [];
  const n = points.length;
  const granularity = macroChartAxisGranularity(rangeId, points[0]!.time, points[n - 1]!.time);
  if (n === 1) return [formatMacroAxisLabel(points[0]!.time, granularity)];

  const indices = macroAxisLabelIndices(n, slotCount);
  const labels = indices.map((idx) => formatMacroAxisLabel(points[idx]!.time, granularity));

  const out: string[] = [];
  for (const label of labels) {
    if (out[out.length - 1] !== label) out.push(label);
  }
  return out.length >= 2 ? out : labels;
}
