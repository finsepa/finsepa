import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/**
 * Total shown in the top bar: sum of positions’ **cost basis** (Overview) plus **net cash**
 * (ledger sum of `sum`, same as Cash tab).
 */
export function portfolioCostBasisPlusCash(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number {
  const cost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const cash = transactions.reduce((s, t) => s + t.sum, 0);
  return cost + cash;
}
