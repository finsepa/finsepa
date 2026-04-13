import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

/**
 * Forward stock split: `ratio` new shares per 1 share held (e.g. 20 for a 20:1 split).
 * Cost basis unchanged; average cost and quoted price scale inversely.
 */
export function applyStockSplitToHolding(h: PortfolioHolding, ratio: number): PortfolioHolding | null {
  if (!(ratio > 0) || ratio === 1 || h.shares <= 0) return h;
  const newShares = h.shares * ratio;
  const newCost = h.costBasis;
  const newAvg = newCost / newShares;
  const newMarketPrice = h.marketPrice / ratio;
  return {
    ...h,
    shares: newShares,
    avgPrice: newAvg,
    costBasis: newCost,
    marketPrice: newMarketPrice,
    currentValue: newShares * newMarketPrice,
  };
}
