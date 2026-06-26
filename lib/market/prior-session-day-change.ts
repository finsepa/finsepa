import type { StockPerformance } from "@/lib/market/stock-performance-types";

export type PriorSessionDayChange = {
  closePrice: number;
  changeAbs: number;
  changePct: number;
};

function positiveUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Regular-session close and that session's day move vs the prior trading day's close.
 * Used for the left header column during pre-market / after-hours.
 */
export function priorSessionDayChangeFromPerformance(
  performance: StockPerformance | null | undefined,
  priorCloseUsd?: number | null,
): PriorSessionDayChange | null {
  const close = performance?.price;
  if (!positiveUsd(close)) return null;

  const d1 = performance?.d1;

  let priorFromD1: number | null = null;
  if (d1 != null && Number.isFinite(d1) && Math.abs(100 + d1) > 1e-6) {
    const implied = close / (1 + d1 / 100);
    if (Number.isFinite(implied) && implied > 0) priorFromD1 = implied;
  }

  let priorFromQuote: number | null = null;
  if (positiveUsd(priorCloseUsd) && Math.abs(priorCloseUsd - close) > 0.0001) {
    priorFromQuote = priorCloseUsd;
  }

  const prior = priorFromD1 ?? priorFromQuote;
  if (prior == null) return null;

  const changeAbs = close - prior;
  const changePct =
    d1 != null && Number.isFinite(d1) ? d1 : (changeAbs / prior) * 100;

  return { closePrice: close, changeAbs, changePct };
}
