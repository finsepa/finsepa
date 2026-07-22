import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { fetchPortfolioLivePricesClient } from "@/lib/portfolio/client-symbol-quotes";
import { applyLivePricesToHoldings } from "@/lib/portfolio/apply-live-prices-to-holdings";
import { replayPortfolioLedger } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

/**
 * Replays `kind === "trade"` rows in canonical chronological order into a holdings list.
 * Uses fill `price` as provisional `marketPrice` until refreshed via quotes.
 * Display mode preserves legacy soft handling for tagged anomalies.
 */
export function replayTradeTransactionsToHoldingsUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): PortfolioHolding[] {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  return replayPortfolioLedger(migrated, {
    mode: "display",
    asOfYmd,
  }).holdings;
}

export function replayTradeTransactionsToHoldings(
  transactions: PortfolioTransaction[],
): PortfolioHolding[] {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  return replayPortfolioLedger(migrated, { mode: "display" }).holdings;
}

/** Fetch last price per symbol and refresh `marketPrice` / `currentValue`. */
export async function refreshHoldingMarketPrices(
  holdings: PortfolioHolding[],
  fallbackPrices?: Record<string, number | null | undefined>,
  opts?: { preferFallback?: boolean },
): Promise<PortfolioHolding[]> {
  if (!holdings.length) return holdings;
  const symbols = [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))];
  const prices = await fetchPortfolioLivePricesClient(symbols);
  const merged: Record<string, number | null> = {};
  for (const sym of symbols) {
    const live = prices[sym];
    const fb = fallbackPrices?.[sym];
    const liveOk = live != null && Number.isFinite(live) && live > 0;
    const fbOk = fb != null && Number.isFinite(fb) && fb > 0;
    if (opts?.preferFallback && fbOk) {
      merged[sym] = fb as number;
      continue;
    }
    if (liveOk) {
      merged[sym] = live;
      continue;
    }
    if (fbOk) {
      merged[sym] = fb as number;
      continue;
    }
    merged[sym] = null;
  }
  return applyLivePricesToHoldings(holdings, merged);
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
