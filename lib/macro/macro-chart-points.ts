import type { MacroRangeId } from "@/components/macro/macro-range";

export type MacroChartPoint = { time: string; value: number };

const RANGE_YEARS: Partial<Record<MacroRangeId, number>> = {
  "5y": 5,
  "10y": 10,
  "20y": 20,
  "1y": 1,
};

function parseYmdParts(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

/** Calendar slice for the selected range (inclusive of last observation). */
export function sliceMacroPointsByRange(
  points: readonly MacroChartPoint[],
  rangeId: MacroRangeId,
): MacroChartPoint[] {
  if (rangeId === "all" || points.length === 0) return [...points];

  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const last = sorted[sorted.length - 1]!.time.trim().slice(0, 10);
  const parts = parseYmdParts(last);
  if (!parts) return sorted;

  if (rangeId === "ytd") {
    const startStr = `${parts.y.toString().padStart(4, "0")}-01-01`;
    return sorted.filter((p) => p.time.slice(0, 10) >= startStr);
  }

  if (rangeId === "1m") {
    const startMs = Date.UTC(parts.y, parts.m - 1, parts.d);
    const start = new Date(startMs);
    start.setUTCMonth(start.getUTCMonth() - 1);
    const startStr = start.toISOString().slice(0, 10);
    return sorted.filter((p) => p.time.slice(0, 10) >= startStr);
  }

  const years = RANGE_YEARS[rangeId];
  if (years == null || !Number.isFinite(years) || years <= 0) return sorted;

  const startMs = Date.UTC(parts.y - years, parts.m - 1, parts.d);
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

/** Sum daily values into ISO weeks (time = last observation in the week). */
export function aggregateMacroPointsWeeklySum(points: readonly MacroChartPoint[]): MacroChartPoint[] {
  if (points.length <= 1) return [...points];
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const byWeek = new Map<string, MacroChartPoint>();
  for (const p of sorted) {
    const t = p.time.slice(0, 10);
    const weekKey = isoWeekKeyUtc(t);
    if (!weekKey) continue;
    const prev = byWeek.get(weekKey);
    byWeek.set(weekKey, {
      time: t,
      value: (prev?.value ?? 0) + p.value,
    });
  }
  return Array.from(byWeek.values()).sort((a, b) => a.time.localeCompare(b.time));
}

/** Sum daily values into calendar months (time = last observation in the month). */
export function aggregateMacroPointsMonthlySum(points: readonly MacroChartPoint[]): MacroChartPoint[] {
  if (points.length <= 1) return [...points];
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const byMonth = new Map<string, MacroChartPoint>();
  for (const p of sorted) {
    const t = p.time.slice(0, 10);
    const monthKey = t.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    const prev = byMonth.get(monthKey);
    byMonth.set(monthKey, {
      time: t,
      value: (prev?.value ?? 0) + p.value,
    });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.time.localeCompare(b.time));
}

/** Fixed long ranges use one point per calendar month (when source data allows). */
export function macroRangeUsesMonthlyPoints(rangeId: MacroRangeId): boolean {
  return rangeId === "5y" || rangeId === "10y" || rangeId === "20y";
}

export function macroRangeUsesMonthlyAxisLabels(_rangeId: MacroRangeId): boolean {
  return false;
}

function shouldDownsampleForRange(pointCount: number, rangeId: MacroRangeId): boolean {
  if (pointCount <= 72) return false;
  if (rangeId === "1m" || rangeId === "ytd" || rangeId === "1y") return false;
  if (rangeId === "all") return pointCount > 180;
  const years = RANGE_YEARS[rangeId];
  if (!years) return pointCount > 180;
  return pointCount > years * 40;
}

/** Drop a leading calendar year that isn’t a full 12 months (keeps year bands evenly spaced). */
export function dropLeadingPartialCalendarYear(
  points: readonly MacroChartPoint[],
): MacroChartPoint[] {
  if (points.length < 2) return [...points];
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const firstYear = sorted[0]!.time.trim().slice(0, 4);
  const lastYear = sorted[sorted.length - 1]!.time.trim().slice(0, 4);
  if (!/^\d{4}$/.test(firstYear) || firstYear === lastYear) return sorted;

  const leading = sorted.filter((p) => p.time.trim().slice(0, 4) === firstYear);
  const startsInJanuary = sorted[0]!.time.trim().slice(5, 7) === "01";
  if (leading.length >= 12 && startsInJanuary) return sorted;

  return sorted.filter((p) => p.time.trim().slice(0, 4) !== firstYear);
}

/**
 * Slice to the selected range, then thin dense daily series for chart readability.
 * @param options.dailyFlowBars — BTC ETF flows: 1Y → weekly sums, All → monthly sums; 1M/YTD stay daily.
 * @param options.preserveDaily — keep every daily point (legacy; prefer `dailyFlowBars` for flows).
 */
export function prepareMacroPointsForRange(
  points: readonly MacroChartPoint[],
  rangeId: MacroRangeId,
  options?: { preserveDaily?: boolean; dailyFlowBars?: boolean },
): MacroChartPoint[] {
  const sliced = sliceMacroPointsByRange(points, rangeId);

  if (options?.dailyFlowBars) {
    if (rangeId === "1y") return aggregateMacroPointsWeeklySum(sliced);
    if (rangeId === "all") return aggregateMacroPointsMonthlySum(sliced);
    return sliced;
  }

  if (options?.preserveDaily) return sliced;

  if (macroRangeUsesMonthlyPoints(rangeId)) {
    const monthly = downsampleMacroPointsMonthly(sliced);
    const base = monthly.length > 0 ? monthly : sliced;
    return dropLeadingPartialCalendarYear(base);
  }
  if (shouldDownsampleForRange(sliced.length, rangeId)) {
    return dropLeadingPartialCalendarYear(downsampleMacroPointsMonthly(sliced));
  }
  return sliced;
}

/** X-axis label granularity for macro bar / line charts. */
export type MacroAxisGranularity = "week" | "month" | "year";

/**
 * @param options.dailySeries — BTC ETF-style daily points: All → months, 1Y → weeks.
 */
export function macroChartAxisGranularity(
  rangeId: MacroRangeId,
  _firstTime: string,
  _lastTime: string,
  options?: { dailySeries?: boolean },
): MacroAxisGranularity {
  if (options?.dailySeries) {
    if (rangeId === "1y") return "week";
    if (rangeId === "all" || rangeId === "ytd" || rangeId === "1m") return "month";
  }
  if (rangeId === "1m" || rangeId === "ytd" || rangeId === "1y") return "month";
  return "year";
}

export function formatMacroAxisLabel(time: string, granularity: MacroAxisGranularity): string {
  const t = time.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t.slice(0, 4);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (!Number.isFinite(d.getTime())) return t.slice(0, 4);
  if (granularity === "week") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
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

/**
 * Label indices for the macro time axis. Year mode uses one tick per calendar year
 * (mid point in that year), thinned to `maxLabels`. Week / month modes use one tick
 * per ISO week / calendar month (mid point), then thin.
 */
export function macroAxisLabelIndicesForTimes(
  times: readonly string[],
  maxLabels = 8,
  granularity: MacroAxisGranularity = "year",
): number[] {
  if (times.length === 0) return [];
  if (granularity === "year") {
    const indicesByYear = new Map<string, number[]>();
    for (let i = 0; i < times.length; i++) {
      const y = times[i]!.trim().slice(0, 4);
      if (!/^\d{4}$/.test(y)) continue;
      const list = indicesByYear.get(y);
      if (list) list.push(i);
      else indicesByYear.set(y, [i]);
    }
    const yearIndices = [...indicesByYear.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, idxs]) => idxs[Math.floor((idxs.length - 1) / 2)]!);

    if (yearIndices.length === 0) return macroAxisLabelIndices(times.length, maxLabels);
    if (yearIndices.length <= maxLabels) return yearIndices;
    return macroAxisLabelIndices(yearIndices.length, maxLabels).map((i) => yearIndices[i]!);
  }

  const buckets = new Map<string, number[]>();
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!.trim().slice(0, 10);
    const key = granularity === "week" ? isoWeekKeyUtc(t) : t.slice(0, 7);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  const bucketIndices = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, idxs]) => idxs[Math.floor((idxs.length - 1) / 2)]!);

  if (bucketIndices.length === 0) return macroAxisLabelIndices(times.length, maxLabels);
  // Dense daily “All” can have ~30 months — allow a few more ticks than the default 8.
  const cap = granularity === "month" ? Math.max(maxLabels, 12) : Math.max(maxLabels, 10);
  if (bucketIndices.length <= cap) return bucketIndices;
  return macroAxisLabelIndices(bucketIndices.length, cap).map((i) => bucketIndices[i]!);
}

/** Monday-based ISO week key `YYYY-Www` in UTC. */
function isoWeekKeyUtc(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!Number.isFinite(d.getTime())) return null;
  // ISO week date algorithm (UTC).
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Bottom time-axis strip labels (area / line card footer). */
export function macroChartTimeAxisLabels(
  points: readonly { time: string }[],
  rangeId: MacroRangeId,
  slotCount = 6,
  options?: { dailySeries?: boolean },
): string[] {
  if (!points.length) return [];
  const n = points.length;
  const granularity = macroChartAxisGranularity(
    rangeId,
    points[0]!.time,
    points[n - 1]!.time,
    options,
  );
  if (n === 1) return [formatMacroAxisLabel(points[0]!.time, granularity)];

  const times = points.map((p) => p.time);
  const indices = macroAxisLabelIndicesForTimes(times, slotCount, granularity);
  const labels = indices.map((idx) => formatMacroAxisLabel(points[idx]!.time, granularity));

  const out: string[] = [];
  for (const label of labels) {
    if (out[out.length - 1] !== label) out.push(label);
  }
  return out.length >= 2 ? out : labels;
}
