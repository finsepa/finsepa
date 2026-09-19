/**
 * Combine an as-traded intraday print with the split-adjusted daily close.
 *
 * EODHD 1h/1m bars are as-traded. Portfolio EOD `.close` is adjusted (continuous),
 * matching demo buy prices after corporate actions (e.g. NFLX 10:1 on 2025-11-17).
 * Preferring raw hourly marks across a split 10×-inflates NAV until the split prints.
 */

/** Treat a 2×+ gap as a split-scale mismatch, not a same-session move. */
export const INTRADAY_VS_ADJUSTED_EOD_SPLIT_RATIO = 2;

/**
 * - `prefer-compatible-intraday` — short ranges (1D/5D/1M): use hourly when it agrees with EOD;
 *   allow naked hourly only when EOD is missing (live session).
 * - `adjusted-eod-only` — multi-month NAV (6M/YTD/1Y/…): never trust as-traded prints.
 */
export type SessionMarkMode = "prefer-compatible-intraday" | "adjusted-eod-only";

export function sessionMarkUsd(
  intradayPx: number | null | undefined,
  adjustedEodPx: number | null | undefined,
  mode: SessionMarkMode = "prefer-compatible-intraday",
): number | null {
  const intra =
    intradayPx != null && Number.isFinite(intradayPx) && intradayPx > 0 ? intradayPx : null;
  const eod =
    adjustedEodPx != null && Number.isFinite(adjustedEodPx) && adjustedEodPx > 0 ?
      adjustedEodPx
    : null;

  if (mode === "adjusted-eod-only") {
    return eod;
  }

  if (intra != null && eod != null) {
    const ratio = intra >= eod ? intra / eod : eod / intra;
    if (ratio >= INTRADAY_VS_ADJUSTED_EOD_SPLIT_RATIO) return eod;
    return intra;
  }
  if (eod != null) return eod;
  // Live / same-session only: EOD not published yet.
  return intra;
}
