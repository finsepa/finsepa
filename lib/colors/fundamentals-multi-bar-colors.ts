import { resolveFsColor } from "@/lib/theme/resolve-fs-color";

/**
 * Canonical order for multiple fundamentals bars (e.g. fiscal periods in a row, or stacked metrics).
 * Reused by Key Stats modal multichart, Charting workspace histograms, and compare workspace.
 * Index 0 resolves to `--fs-accent` so dark mode uses the theme blue.
 */
export const FUNDAMENTALS_MULTI_BAR_COLORS = [
  "#2563EB",
  "#EA580C",
  "#16A34A",
  "#DC2626",
  "#EAB308",
  "#9333EA",
] as const;

export function fundamentalsBarSolidAtIndex(i: number): string {
  const n = FUNDAMENTALS_MULTI_BAR_COLORS.length;
  const idx = ((i % n) + n) % n;
  if (idx === 0) return resolveFsColor("--fs-accent");
  return FUNDAMENTALS_MULTI_BAR_COLORS[idx]!;
}

/** Solid bar color at a given opacity (hex palette only). */
export function fundamentalsBarColorAtIndex(i: number, opacity: number): string {
  const solid = fundamentalsBarSolidAtIndex(i);
  if (opacity >= 1) return solid;
  if (opacity <= 0) return "rgba(0,0,0,0)";
  const m = solid.match(/^#([0-9a-f]{6})$/i);
  if (!m) return solid;
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Slightly transparent fill for overlapping histogram columns (lightweight-charts). */
export function fundamentalsBarHistogramDisplayAtIndex(i: number): string {
  const solid = fundamentalsBarSolidAtIndex(i);
  const m = solid.match(/^#([0-9a-f]{6})$/i);
  if (!m) return solid;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},0.58)`;
}
