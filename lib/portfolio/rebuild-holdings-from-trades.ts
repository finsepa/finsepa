import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { newHoldingId } from "@/components/portfolio/portfolio-types";
import { applyStockSplitToHolding } from "@/lib/portfolio/apply-stock-split-to-holding";
import { fetchPortfolioLivePricesClient } from "@/lib/portfolio/client-symbol-quotes";
import { applyLivePricesToHoldings } from "@/lib/portfolio/apply-live-prices-to-holdings";
import { mergeBuyIntoPosition, type BuyLot } from "@/lib/portfolio/holding-position";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";

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
/**
 * Replays trades through {@link asOfYmd} (inclusive) into holdings (same rules as full replay).
 */
export function replayTradeTransactionsToHoldingsUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): PortfolioHolding[] {
  const trades = transactions
    .filter((t) => t.kind === "trade" && t.date <= asOfYmd)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
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
    } else if (op === "split") {
      if (!existing) continue;
      const ratio = splitRatioFromTransaction(t) ?? 1;
      const next = applyStockSplitToHolding(existing, ratio);
      if (next) bySymbol.set(sym, next);
    } else if (op === "sell") {
      if (!existing) continue;
      const next = applySellToHolding(existing, t.shares);
      if (next) bySymbol.set(sym, next);
      else bySymbol.delete(sym);
    }
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function replayTradeTransactionsToHoldings(transactions: PortfolioTransaction[]): PortfolioHolding[] {
  const trades = transactions
    .filter((t) => t.kind === "trade")
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
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
    } else if (op === "split") {
      if (!existing) continue;
      const ratio = splitRatioFromTransaction(t) ?? 1;
      const next = applyStockSplitToHolding(existing, ratio);
      if (next) bySymbol.set(sym, next);
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
  if (!holdings.length) return holdings;
  const symbols = [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))];
  const prices = await fetchPortfolioLivePricesClient(symbols);
  return applyLivePricesToHoldings(holdings, prices);
}

export { applyLivePricesToHoldings };

/** Batch live quotes once across all portfolios. */
export async function refreshHoldingsByPortfolioIdMarketPrices(
  holdingsByPortfolioId: Record<string, PortfolioHolding[]>,
): Promise<Record<string, PortfolioHolding[]>> {
  const uniqueSymbols = new Set<string>();
  for (const holds of Object.values(holdingsByPortfolioId)) {
    for (const h of holds) {
      const sym = h.symbol.trim().toUpperCase();
      if (sym) uniqueSymbols.add(sym);
    }
  }
  const symbols = Array.from(uniqueSymbols);
  const prices = symbols.length ? await fetchPortfolioLivePricesClient(symbols) : {};

  const out: Record<string, PortfolioHolding[]> = {};
  for (const [pid, holds] of Object.entries(holdingsByPortfolioId)) {
    out[pid] = applyLivePricesToHoldings(holds, prices);
  }
  return out;
}
