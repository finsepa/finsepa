/**
 * Pure helpers for matching trade prices to EODHD adjusted vs unadjusted closes.
 */

function relErr(a: number, b: number): number {
  if (!(b > 0) || !(a > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / b;
}

/**
 * True when {@link stored} matches split-adjusted close far better than as-traded.
 * (Legacy autofill before continuous-price model.)
 */
export function isLikelySplitAdjustedClosePrice(
  stored: number,
  adjustedClose: number,
  unadjustedClose: number,
): boolean {
  if (!(stored > 0) || !(adjustedClose > 0) || !(unadjustedClose > 0)) return false;
  if (relErr(stored, unadjustedClose) <= 0.03) return false;
  if (relErr(stored, adjustedClose) > 0.05) return false;
  if (relErr(stored, unadjustedClose) < 0.12) return false;
  if (relErr(adjustedClose, unadjustedClose) < 0.08) return false;
  return true;
}

/**
 * True when {@link stored} matches as-traded unadjusted close after a material split
 * (e.g. temporary "as-traded heal" that inflated cash outflows 10×).
 */
export function isLikelyAsTradedCloseAfterSplit(
  stored: number,
  adjustedClose: number,
  unadjustedClose: number,
): boolean {
  if (!(stored > 0) || !(adjustedClose > 0) || !(unadjustedClose > 0)) return false;
  // Must match unadjusted closely.
  if (relErr(stored, unadjustedClose) > 0.03) return false;
  // Adjusted must differ (otherwise leave alone — already continuous / no split gap).
  if (relErr(adjustedClose, unadjustedClose) < 0.08) return false;
  // Not already on adjusted scale.
  if (relErr(stored, adjustedClose) <= 0.05) return false;
  return true;
}
