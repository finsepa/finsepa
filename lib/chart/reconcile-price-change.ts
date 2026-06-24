/** Period move % from absolute change and prior price (same reference as abs). */
export function changePctFromPrior(abs: number, priorPrice: number): number | null {
  if (!Number.isFinite(abs) || !Number.isFinite(priorPrice) || Math.abs(priorPrice) < 1e-12) {
    return null;
  }
  return (abs / priorPrice) * 100;
}

/** Keep abs/pct sign-aligned; prefer recomputing pct from price + abs when they disagree. */
export function reconcilePriceChangePair(
  price: number | null,
  abs: number | null,
  pct: number | null,
): { abs: number | null; pct: number | null } {
  if (abs == null || pct == null || !Number.isFinite(abs) || !Number.isFinite(pct)) {
    return { abs, pct };
  }
  if ((abs >= 0) === (pct >= 0)) return { abs, pct };

  if (price != null && Number.isFinite(price)) {
    const prior = price - abs;
    const derived = changePctFromPrior(abs, prior);
    if (derived != null) return { abs, pct: derived };
  }

  return { abs, pct: abs >= 0 ? Math.abs(pct) : -Math.abs(pct) };
}

export function isPositivePriceChange(abs: number | null, pct: number | null): boolean {
  if (abs != null && Number.isFinite(abs) && pct != null && Number.isFinite(pct)) {
    if ((abs >= 0) !== (pct >= 0)) return abs >= 0;
    return pct >= 0;
  }
  if (pct != null && Number.isFinite(pct)) return pct >= 0;
  if (abs != null && Number.isFinite(abs)) return abs >= 0;
  return true;
}
