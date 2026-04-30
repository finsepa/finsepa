/**
 * Heatmap performance legend (discrete buckets −3 … +3).
 *
 * | Step | Hex     |
 * |------|---------|
 * | +3   | #22C55E |
 * | +2   | #15803D |
 * | +1   | #14532D |
 * |  0   | #71717A |
 * | −1   | #7F1D1D |
 * | −2   | #B91C1C |
 * | −3   | #EF4444 |
 */
const BUCKET_HEX: Record<number, string> = {
  [-3]: "#EF4444",
  [-2]: "#B91C1C",
  [-1]: "#7F1D1D",
  0: "#71717A",
  1: "#14532D",
  2: "#15803D",
  3: "#22C55E",
};

export const HEATMAP_LEGEND_STEPS = [-3, -2, -1, 0, 1, 2, 3] as const;

export function heatmapLegendHex(step: number): string {
  return BUCKET_HEX[step] ?? "#71717A";
}

/** Tooltip / list: positive % (legend +2). */
export const HEATMAP_LABEL_POSITIVE_HEX = heatmapLegendHex(2);
/** Tooltip / list: negative % (legend −3). */
export const HEATMAP_LABEL_NEGATIVE_HEX = heatmapLegendHex(-3);

function bucketChange(changePct: number): number {
  return Math.max(-3, Math.min(3, Math.round(changePct)));
}

/** Cell fill: maps % change to legend buckets. */
export function heatmapCellBackground(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct)) return "#71717A";
  return BUCKET_HEX[bucketChange(changePct)] ?? "#71717A";
}

export function heatmapCellTextClass(_changePct: number | null): string {
  return "text-white";
}
