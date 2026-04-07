import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/**
 * Cost basis of positions plus net cash (ledger `sum`). Overview **Value** uses market value
 * (`totalNetWorth`); the top bar uses that same figure for parity with the portfolio page.
 */
export function portfolioCostBasisPlusCash(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number {
  const cost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const cash = transactions.reduce((s, t) => s + t.sum, 0);
  return cost + cash;
}
