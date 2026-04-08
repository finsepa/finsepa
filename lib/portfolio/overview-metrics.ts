import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export function netCashUsd(transactions: PortfolioTransaction[]): number {
  return transactions.reduce((s, t) => s + t.sum, 0);
}

/** Cash ledger balance after all rows on or before {@link ymd} (inclusive). */
export function netCashUsdUpTo(transactions: PortfolioTransaction[], ymd: string): number {
  let s = 0;
  for (const t of transactions) {
    if (t.date <= ymd) s += t.sum;
  }
  return s;
}

/** Sum of market value of positions plus net cash (total net worth). */
export function totalNetWorth(holdings: PortfolioHolding[], cashUsd: number): number {
  const equity = holdings.reduce((s, h) => s + h.currentValue, 0);
  return equity + cashUsd;
}

/** Capital invested in open positions at cost (excludes cash). */
export function totalCostBasisInvested(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + h.costBasis, 0);
}

/** Unrealized P/L on stock positions. */
export function unrealizedProfitUsd(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + (h.currentValue - h.costBasis), 0);
}

export function unrealizedProfitPct(holdings: PortfolioHolding[]): number | null {
  const cost = totalCostBasisInvested(holdings);
  if (cost <= 0) return null;
  return (unrealizedProfitUsd(holdings) / cost) * 100;
}

export function equityMarketValue(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + h.currentValue, 0);
}
