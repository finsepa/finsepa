import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { newHoldingId } from "@/components/portfolio/portfolio-types";

/** Merge standard portfolios’ holdings by symbol (shares and cost weighted). */
export function mergeHoldingsBySymbol(lists: PortfolioHolding[][]): PortfolioHolding[] {
  const map = new Map<string, PortfolioHolding>();
  for (const list of lists) {
    for (const h of list) {
      const k = h.symbol.toUpperCase();
      const prev = map.get(k);
      if (!prev) {
        map.set(k, { ...h, id: newHoldingId() });
        continue;
      }
      const shares = prev.shares + h.shares;
      const cost = prev.costBasis + h.costBasis;
      const mp =
        shares > 0 ? (prev.marketPrice * prev.shares + h.marketPrice * h.shares) / shares : prev.marketPrice;
      map.set(k, {
        ...prev,
        shares,
        costBasis: cost,
        avgPrice: shares > 0 ? cost / shares : 0,
        marketPrice: mp,
        currentValue: shares * mp,
        name: prev.name || h.name,
        logoUrl: prev.logoUrl ?? h.logoUrl,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.currentValue - a.currentValue);
}

/** Concatenate ledgers and sort newest-first (same ordering as transactions table groups). */
export function mergeTransactionsSorted(lists: PortfolioTransaction[][]): PortfolioTransaction[] {
  const merged = lists.flat();
  merged.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });
  return merged;
}
