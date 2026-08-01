/**
 * Heatmap performance legend (discrete buckets −3 … +3).
 *
 * Light: Figma performance scale (Finsepa heatmaps).
 * Dark: charcoal near-flat + vivid extremes — see `--fs-heatmap-*` in `app/globals.css`.
 *
 * | Step | Light   | Dark (approx) |
 * |------|---------|---------------|
 * | +3   | #56BC71 | #00C853       |
 * | +2   | #429457 | #009E48       |
 * | +1   | #36714D | #1E2C24       |
 * |  0   | #3E434B | #2A2A2C       |
 * | −1   | #843741 | #2E1E21       |
 * | −2   | #AE353E | #C62828       |
 * | −3   | #DD434B | #E53935       |
 */

const BUCKET_VAR: Record<number, string> = {
  [-3]: "var(--fs-heatmap-n3)",
  [-2]: "var(--fs-heatmap-n2)",
  [-1]: "var(--fs-heatmap-n1)",
  0: "var(--fs-heatmap-0)",
  1: "var(--fs-heatmap-1)",
  2: "var(--fs-heatmap-2)",
  3: "var(--fs-heatmap-3)",
};

const HEATMAP_NEUTRAL = BUCKET_VAR[0];

export const HEATMAP_LEGEND_STEPS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** CSS color for a legend step (theme-aware via `--fs-heatmap-*`). */
export function heatmapLegendHex(step: number): string {
  return BUCKET_VAR[step] ?? HEATMAP_NEUTRAL;
}

/** Tooltip / list: positive % (legend +2). */
export const HEATMAP_LABEL_POSITIVE_HEX = heatmapLegendHex(2);
/** Tooltip / list: negative % (legend −3). */
export const HEATMAP_LABEL_NEGATIVE_HEX = heatmapLegendHex(-3);

/** Tile grid stroke between cells — white on light, black on dark. */
export const HEATMAP_TILE_STROKE = "var(--fs-heatmap-tile-stroke)";

/** Map % change to legend step −3…+3. Non-zero moves never use the neutral (0) bucket. */
function bucketChange(changePct: number): number {
  if (!Number.isFinite(changePct) || changePct === 0) return 0;
  const sign = changePct > 0 ? 1 : -1;
  const magnitude = Math.max(1, Math.min(3, Math.round(Math.abs(changePct))));
  return sign * magnitude;
}

/** Cell fill: maps % change to legend buckets (theme CSS vars). */
export function heatmapCellBackground(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct)) return HEATMAP_NEUTRAL;
  return BUCKET_VAR[bucketChange(changePct)] ?? HEATMAP_NEUTRAL;
}

export function heatmapCellTextClass(_changePct: number | null): string {
  return "text-white";
}
