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

/** Calendar year from `periodEnd` for section headers (ISO prefix). */
export function chartingPeriodSortYear(periodEnd: string): string {
  const s = periodEnd.trim();
  const y = s.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
}
