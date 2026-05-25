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
export function formatChartingPeriodAxisLabel(
  periodEnd: string,
  periodMode: "annual" | "quarterly",
): string {
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
