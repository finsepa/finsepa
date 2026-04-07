import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

export type BuyLot = {
  /** New position id when `existing` is null; otherwise ignored (keeps `existing.id`). */
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  shares: number;
  price: number;
  fee: number;
  /** Latest quote used to mark the whole position to market. */
  marketPrice: number;
};

/**
 * Merges a buy into an existing row for the same symbol, or creates a new row.
 *
 * - **Average price** = total cost ÷ total shares (weighted across lots).
 * - **Cost basis** = sum of what you paid for all shares still held (incl. fees). It does not
 *   change when the market moves; **current value** and **returns** do.
 */
export function mergeBuyIntoPosition(existing: PortfolioHolding | null, lot: BuyLot): PortfolioHolding {
  const lotCost = lot.shares * lot.price + lot.fee;

  if (!existing) {
    return {
      id: lot.id,
      symbol: lot.symbol.toUpperCase(),
      name: lot.name,
      logoUrl: lot.logoUrl,
      shares: lot.shares,
      avgPrice: lotCost / lot.shares,
      costBasis: lotCost,
      marketPrice: lot.marketPrice,
      currentValue: lot.shares * lot.marketPrice,
    };
  }

  const newShares = existing.shares + lot.shares;
  const newCostBasis = existing.costBasis + lotCost;
  const newAvgPrice = newCostBasis / newShares;

  return {
    ...existing,
    id: existing.id,
    symbol: lot.symbol.toUpperCase(),
    name: lot.name,
    logoUrl: lot.logoUrl ?? existing.logoUrl,
    shares: newShares,
    avgPrice: newAvgPrice,
    costBasis: newCostBasis,
    marketPrice: lot.marketPrice,
    currentValue: newShares * lot.marketPrice,
  };
}

/** Unrealized P/L for a single fill (used on the Transactions row for that buy). */
export function lotUnrealizedPnL(lot: {
  shares: number;
  price: number;
  fee: number;
  marketPrice: number;
}): { profitUsd: number; profitPct: number | null } {
  const lotCost = lot.shares * lot.price + lot.fee;
  const lotValue = lot.shares * lot.marketPrice;
  const profitUsd = lotValue - lotCost;
  const profitPct = lotCost > 0 ? (profitUsd / lotCost) * 100 : null;
  return { profitUsd, profitPct };
}
