import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { newHoldingId } from "@/components/portfolio/portfolio-types";
import { mergeBuyIntoPosition, type BuyLot } from "@/lib/portfolio/holding-position";

/**
 * Cost basis removed when selling `sharesSold` from a holding (average-cost method).
 */
function costBasisForSoldShares(h: PortfolioHolding, sharesSold: number): number {
  if (sharesSold <= 0 || h.shares <= 0) return 0;
  const sold = Math.min(sharesSold, h.shares);
  return (sold / h.shares) * h.costBasis;
}

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

function sortTradeRows(transactions: PortfolioTransaction[]): PortfolioTransaction[] {
  return transactions
    .filter((t) => t.kind === "trade")
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id.localeCompare(b.id);
    });
}

/**
 * Sums realized P/L from every sell in {@link trades} (pre-filtered trade rows, date order).
 * Proceeds = `sum` on the sell row; cost = average-cost basis of shares sold.
 */
function cumulativeRealizedGainFromSortedTrades(trades: PortfolioTransaction[]): number {
  const bySymbol = new Map<string, PortfolioHolding>();
  let realized = 0;

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
      const proceeds = t.sum;
      if (!Number.isFinite(proceeds)) continue;
      const costRemoved = costBasisForSoldShares(existing, t.shares);
      realized += proceeds - costRemoved;
      const next = applySellToHolding(existing, t.shares);
      if (next) bySymbol.set(sym, next);
      else bySymbol.delete(sym);
    }
  }

  return realized;
}

/**
 * Realized equity P/L from sells on or before {@link asOfYmd} (inclusive).
 */
export function cumulativeRealizedGainUsdUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): number {
  const trades = sortTradeRows(transactions).filter((t) => t.date <= asOfYmd);
  return cumulativeRealizedGainFromSortedTrades(trades);
}

/**
 * Sums realized P/L from every sell: cash proceeds (`sum` on the sell row) minus average cost of shares sold.
 * Matches the same buy/sell replay as {@link replayTradeTransactionsToHoldings}.
 */
export function cumulativeRealizedGainUsd(transactions: PortfolioTransaction[]): number {
  return cumulativeRealizedGainFromSortedTrades(sortTradeRows(transactions));
}

/** Unrealized on open lots + realized from all past sells (lifetime trading P/L on equities). */
export function lifetimeEquityProfitUsd(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number {
  const unrealized = holdings.reduce((s, h) => s + (h.currentValue - h.costBasis), 0);
  return unrealized + cumulativeRealizedGainUsd(transactions);
}

export function tradeSymbolsFromHistory(transactions: PortfolioTransaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.kind === "trade") set.add(t.symbol.toUpperCase());
  }
  return [...set].sort();
}
