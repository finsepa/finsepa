/**
 * Whether BaselineSeries `relativeGradient` is safe and looks right.
 * Needs a finite, non-zero span (avoids non-finite CanvasGradient color stops), and the base must sit
 * inside the data range: with a base outside it (e.g. 1D prior close above/below the whole session),
 * the relative fill stops at the series extreme and leaves a flat-topped band short of the baseline.
 */
export function baselineRelativeGradientEnabled(
  data: readonly { value: number }[],
  baseValue: number,
): boolean {
  if (!Number.isFinite(baseValue) || data.length === 0) return false;
  let min = Infinity;
  let max = -Infinity;
  for (const d of data) {
    if (!Number.isFinite(d.value)) continue;
    if (d.value < min) min = d.value;
    if (d.value > max) max = d.value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  if (baseValue < min || baseValue > max) return false;
  const span = max - min;
  return Number.isFinite(span) && span >= 1e-6;
}
