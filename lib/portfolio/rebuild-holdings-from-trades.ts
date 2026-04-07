import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { newHoldingId } from "@/components/portfolio/portfolio-types";
import { mergeBuyIntoPosition, type BuyLot } from "@/lib/portfolio/holding-position";

function applySellToHolding(h: PortfolioHolding, sharesSold: number): PortfolioHolding | null {
  if (sharesSold <= 0) return h;
  const sold = Math.min(sharesSold, h.shares);
  if (sold <= 0) return h;
  const costFraction = (sold / h.shares) * h.costBasis;
  const newShares = h.shares - sold;
  if (newShares < 1e-9) return null;
  const newCost = h.costBasis - costFraction;
  return {
    ...h,
    shares: newShares,
    costBasis: newCost,
    avgPrice: newCost / newShares,
    currentValue: newShares * h.marketPrice,
  };
}

/**
 * Replays `kind === "trade"` rows in chronological order into a holdings list.
 * Uses fill `price` as provisional `marketPrice` until refreshed via quotes.
 */
export function replayTradeTransactionsToHoldings(transactions: PortfolioTransaction[]): PortfolioHolding[] {
  const trades = transactions
    .filter((t) => t.kind === "trade")
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id.localeCompare(b.id);
    });

  const bySymbol = new Map<string, PortfolioHolding>();

  for (const t of trades) {
    const sym = t.symbol.toUpperCase();
    const op = t.operation.toLowerCase();
    const existing = bySymbol.get(sym) ?? null;

    if (op === "buy") {
      const positionId = existing?.id ?? t.holdingId ?? newHoldingId();
      const lot: BuyLot = {
        id: positionId,
        symbol: sym,
        name: t.name,
        logoUrl: t.logoUrl,
        shares: t.shares,
        price: t.price,
        fee: t.fee,
        marketPrice: t.price,
      };
      const merged = mergeBuyIntoPosition(existing, lot);
      bySymbol.set(sym, merged);
    } else if (op === "sell") {
      if (!existing) continue;
      const next = applySellToHolding(existing, t.shares);
      if (next) bySymbol.set(sym, next);
      else bySymbol.delete(sym);
    }
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Fetch last price per symbol and refresh `marketPrice` / `currentValue`. */
export async function refreshHoldingMarketPrices(holdings: PortfolioHolding[]): Promise<PortfolioHolding[]> {
  const results = await Promise.all(
    holdings.map(async (h) => {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(h.symbol)}/performance`);
        if (!res.ok) return h;
        const data = (await res.json()) as { price?: number | null };
        const p =
          typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0 ? data.price : h.marketPrice;
        return {
          ...h,
          marketPrice: p,
          currentValue: h.shares * p,
        };
      } catch {
        return h;
      }
    }),
  );
  return results;
}
