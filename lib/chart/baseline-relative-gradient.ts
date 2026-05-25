/** Whether BaselineSeries `relativeGradient` is safe (avoids non-finite CanvasGradient color stops). */
export function baselineRelativeGradientEnabled(
  data: readonly { value: number }[],
  baseValue: number,
): boolean {
  if (!Number.isFinite(baseValue) || data.length === 0) return false;
  let min = baseValue;
  let max = baseValue;
  let seen = 0;
  for (const d of data) {
    if (!Number.isFinite(d.value)) continue;
    seen += 1;
    if (d.value < min) min = d.value;
    if (d.value > max) max = d.value;
  }
  if (seen === 0) return false;
  const span = max - min;
  return Number.isFinite(span) && span >= 1e-6;
}
