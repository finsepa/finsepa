import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

/** Apply a symbol → price map to holdings (`marketPrice` + `currentValue`). */
export function applyLivePricesToHoldings(
  holdings: PortfolioHolding[],
  prices: Record<string, number | null>,
): PortfolioHolding[] {
  return holdings.map((h) => {
    const p = prices[h.symbol.trim().toUpperCase()];
    if (p == null) return h;
    return {
      ...h,
      marketPrice: p,
      currentValue: h.shares * p,
    };
  });
}
