/**
 * Maximum drawdown / CAGR — not shown in current Key Stats UI.
 * Phase 4: BLOCKED (no UI surface). Chart drawdown mode is separate (NAV path).
 */

export const MAX_DRAWDOWN_STATUS = "BLOCKED" as const;
export const CAGR_STATUS = "BLOCKED" as const;
export const DRAWDOWN_REASON =
  "No Key Stats card for max drawdown or CAGR; chart drawdown metric is unchanged.";
