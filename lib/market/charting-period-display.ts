import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";

/**
 * Period-end strings from fundamentals APIs are typically `YYYY-MM-DD`.
 * Parse as UTC noon so calendar month/day match the stored fiscal period end.
 */
export function parseChartingPeriodEndUtc(periodEnd: string): Date | null {
  const s = periodEnd.trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : `${s}T12:00:00.000Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Slanted x-axis copy — annual fiscal year (e.g. `2024`); quarterly `Q2 '25`.
 * Matches Multichart fundamentals bar axis labels.
 */
export const CHARTING_TTM_PERIOD_END = "TTM";

export function isChartingTtmPeriodEnd(periodEnd: string): boolean {
  return periodEnd.trim().toUpperCase() === CHARTING_TTM_PERIOD_END;
}

export function parseChartingTtmPoint(raw: unknown): ChartingSeriesPoint | null {
  if (!raw || typeof raw !== "object" || !("periodEnd" in raw)) return null;
  return raw as ChartingSeriesPoint;
}

/** Append trailing-twelve-months as the final annual column (Financials-style). */
export function appendChartingTtmPeriod(
  points: ChartingSeriesPoint[],
  ttmPoint: ChartingSeriesPoint | null | undefined,
): ChartingSeriesPoint[] {
  if (!ttmPoint) return points;
  if (points.some((p) => isChartingTtmPeriodEnd(p.periodEnd))) return points;
  return [...points, { ...ttmPoint, periodEnd: CHARTING_TTM_PERIOD_END }];
}

/** Plot time for TTM — one year after the prior fiscal period (calendar-based charts). */
export function chartingTtmPlotTimeSec(
  points: ChartingSeriesPoint[],
  ttmIndex: number,
): number | null {
  for (let i = ttmIndex - 1; i >= 0; i--) {
    const row = points[i];
    if (!row || isChartingTtmPeriodEnd(row.periodEnd)) continue;
    const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
    if (!Number.isFinite(ms)) continue;
    return Math.floor(ms / 1000) + 365 * 86400;
  }
  return null;
}

export function chartingRowPlotTimeSec(
  points: ChartingSeriesPoint[],
  index: number,
): number | null {
  const row = points[index];
  if (!row) return null;
  if (isChartingTtmPeriodEnd(row.periodEnd)) return chartingTtmPlotTimeSec(points, index);
  const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function compareChartingPeriodColumnLabels(
  a: string,
  b: string,
  periodMode: "annual" | "quarterly",
  labelToSampleEnd: Map<string, string>,
): number {
  if (periodMode === "annual") {
    if (a === CHARTING_TTM_PERIOD_END) return b === CHARTING_TTM_PERIOD_END ? 0 : 1;
    if (b === CHARTING_TTM_PERIOD_END) return -1;
    return Number(a) - Number(b);
  }
  return (labelToSampleEnd.get(a) ?? "").localeCompare(labelToSampleEnd.get(b) ?? "");
}

export function formatChartingPeriodAxisLabel(
  periodEnd: string,
  periodMode: "annual" | "quarterly",
): string {
  if (isChartingTtmPeriodEnd(periodEnd)) return CHARTING_TTM_PERIOD_END;
  const s = periodEnd.trim();
  if (periodMode === "quarterly") {
    const year = s.slice(0, 4);
    const m = s.slice(5, 7);
    const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
    const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
    if (!year || !q) return s;
    const yy = year.length >= 2 ? year.slice(2) : year;
    return `Q${q} '${yy}`;
  }
  const d = parseChartingPeriodEndUtc(periodEnd);
  if (d) return String(d.getUTCFullYear());
  const year = s.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : s;
}

/** Up to this many quarterly columns, show every period label (e.g. Key Stats 5Y / 10Y). */
const QUARTERLY_AXIS_LABEL_SHOW_ALL_MAX = 40;

/** Whether to render a slanted period label (Multicharts thinning for dense quarterly columns). */
export function fundamentalsPeriodAxisShowsLabel(
  index: number,
  total: number,
  periodMode: "annual" | "quarterly",
): boolean {
  if (periodMode === "annual") return true;
  if (total <= QUARTERLY_AXIS_LABEL_SHOW_ALL_MAX) return true;
  const last = total - 1;
  return index % 2 === 0 || (index === last && last > 0);
}

/** Primary line for chart axis + tables (annual = year; quarterly = `Q2 2025`). */
export function formatChartingPeriodLabel(periodEnd: string, periodMode: "annual" | "quarterly"): string {
  if (isChartingTtmPeriodEnd(periodEnd)) return CHARTING_TTM_PERIOD_END;
  const s = periodEnd.trim();
  const year = s.slice(0, 4);
  if (periodMode === "annual") return year && /^\d{4}$/.test(year) ? year : s;
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  return year && q ? `Q${q} ${year}` : s;
}

/** Secondary line under quarter/year — e.g. `Apr 29` (Figma-style fiscal period end). */
export function formatChartingPeriodEndShortMd(periodEnd: string): string {
  const d = parseChartingPeriodEndUtc(periodEnd);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Financials “Period Ending” row — month and day only (year is in the Fiscal Year row). */
export function formatFinancialsPeriodEndDisplay(periodEnd: string | null | undefined): string {
  const raw = periodEnd?.trim();
  if (!raw) return "—";
  const label = formatChartingPeriodEndShortMd(raw);
  return label || "—";
}

/** Full calendar date — e.g. `Dec 31, 2025` (UTC calendar date from `periodEnd`). */
export function formatChartingPeriodEndMdYyyy(periodEnd: string): string {
  const d = parseChartingPeriodEndUtc(periodEnd);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Calendar year from `periodEnd` for section headers (ISO prefix). */
export function chartingPeriodSortYear(periodEnd: string): string {
  const s = periodEnd.trim();
  const y = s.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
}
