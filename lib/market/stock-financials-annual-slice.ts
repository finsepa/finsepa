import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";

export const MAX_ANNUAL_FUNDAMENTAL_COLUMNS = 8;

export function ymdYearLabel(periodEnd: string): string {
  const s = periodEnd.trim();
  if (/^\d{4}/.test(s)) return s.slice(0, 4);
  const d = Date.parse(s.includes("T") ? s : `${s}T12:00:00.000Z`);
  if (!Number.isFinite(d)) return s.slice(0, 10);
  return String(new Date(d).getUTCFullYear());
}

export function annualFundamentalsSlice(points: ChartingSeriesPoint[]): {
  columns: string[];
  slice: ChartingSeriesPoint[];
} | null {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const slice = sorted.slice(-MAX_ANNUAL_FUNDAMENTAL_COLUMNS);
  const columns = slice.map((p) => ymdYearLabel(p.periodEnd));
  return { columns, slice };
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const a = Math.abs(prev);
  if (a < 1e-9) return null;
  return ((cur - prev) / a) * 100;
}
