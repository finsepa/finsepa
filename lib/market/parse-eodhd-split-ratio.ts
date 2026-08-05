/**
 * Parse EODHD / import split labels into a **new shares per 1 old share** factor.
 * Examples: `2/1` → 2, `4:1` → 4, `1/10` (reverse) → 0.1.
 */
export function parseEodhdSplitRatioLabel(label: string): number | null {
  const s = label.trim();
  if (!s) return null;

  const forMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:\/|:|for|-for-)\s*(\d+(?:\.\d+)?)$/i);
  if (forMatch) {
    const a = Number(forMatch[1]);
    const b = Number(forMatch[2]);
    if (!(a > 0) || !(b > 0) || a === b) return null;
    return normalizeSplitRatio(a / b);
  }

  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return normalizeSplitRatio(n);
}

/** Guard invalid / no-op ratios. Accepts reverse splits (0 < ratio < 1). */
export function normalizeSplitRatio(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0 || raw === 1) return null;
  if (raw > 1_000_000 || raw < 1 / 1_000_000) return null;
  return raw;
}
