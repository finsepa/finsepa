/**
 * Heatmap performance legend (discrete buckets −3 … +3).
 * Matches Figma performance scale (Finsepa heatmaps).
 *
 * | Step | Hex     |
 * |------|---------|
 * | +3   | #56BC71 |
 * | +2   | #429457 |
 * | +1   | #36714D |
 * |  0   | #3E434B |
 * | −1   | #843741 |
 * | −2   | #AE353E |
 * | −3   | #DD434B |
 */
const BUCKET_HEX: Record<number, string> = {
  [-3]: "#DD434B",
  [-2]: "#AE353E",
  [-1]: "#843741",
  0: "#3E434B",
  1: "#36714D",
  2: "#429457",
  3: "#56BC71",
};

const HEATMAP_NEUTRAL_HEX = BUCKET_HEX[0];

export const HEATMAP_LEGEND_STEPS = [-3, -2, -1, 0, 1, 2, 3] as const;

export function heatmapLegendHex(step: number): string {
  return BUCKET_HEX[step] ?? HEATMAP_NEUTRAL_HEX;
}

/** Tooltip / list: positive % (legend +2). */
export const HEATMAP_LABEL_POSITIVE_HEX = heatmapLegendHex(2);
/** Tooltip / list: negative % (legend −3). */
export const HEATMAP_LABEL_NEGATIVE_HEX = heatmapLegendHex(-3);

/** Map % change to legend step −3…+3. Non-zero moves never use the neutral (0) bucket. */
function bucketChange(changePct: number): number {
  if (!Number.isFinite(changePct) || changePct === 0) return 0;
  const sign = changePct > 0 ? 1 : -1;
  const magnitude = Math.max(1, Math.min(3, Math.round(Math.abs(changePct))));
  return sign * magnitude;
}

/** Cell fill: maps % change to legend buckets. */
export function heatmapCellBackground(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct)) return HEATMAP_NEUTRAL_HEX;
  return BUCKET_HEX[bucketChange(changePct)] ?? HEATMAP_NEUTRAL_HEX;
}

export function heatmapCellTextClass(_changePct: number | null): string {
  return "text-white";
}
