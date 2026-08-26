import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { isLikelyAsTradedCloseAfterSplit } from "@/lib/portfolio/is-likely-split-adjusted-close-price";

function recomputeTradeSum(t: PortfolioTransaction, price: number, shares: number): number {
  const notional = shares * price;
  const fee = Number.isFinite(t.fee) && t.fee > 0 ? t.fee : 0;
  const op = t.operation.trim().toLowerCase();
  if (op === "sell") return notional - fee;
  return -(notional + fee);
}

/**
 * Convert an as-traded fill onto the continuous (split-adjusted) price scale.
 * Scales shares by unadjusted/adjusted so notional / cost basis is preserved
 * (e.g. 4 @ $330 → 40 @ $33 after a 10:1 split).
 */
export function restoreTradeToAdjustedCloseScale(
  t: PortfolioTransaction,
  bar: { close: number; adjustedClose: number },
): PortfolioTransaction | null {
  if (t.kind !== "trade") return null;
  const op = t.operation.trim().toLowerCase();
  if (op !== "buy" && op !== "sell") return null;
  if (!isLikelyAsTradedCloseAfterSplit(t.price, bar.adjustedClose, bar.close)) return null;

  const unadj = bar.close;
  const adj = bar.adjustedClose;
  if (!(unadj > 0) || !(adj > 0)) return null;
  const scale = unadj / adj;
  if (!(scale > 1.05) || !Number.isFinite(scale)) return null;

  const shares = Math.round(t.shares * scale * 1e6) / 1e6;
  if (!(shares > 0)) return null;
  const price = adj;
  return {
    ...t,
    shares,
    price,
    sum: recomputeTradeSum(t, price, shares),
  };
}
