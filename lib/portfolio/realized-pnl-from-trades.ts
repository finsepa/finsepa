import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import { replayPortfolioLedger } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

/**
 * Realized equity P/L from sells on or before {@link asOfYmd} (inclusive).
 */
export function cumulativeRealizedGainUsdUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): number {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  return replayPortfolioLedger(migrated, { mode: "display", asOfYmd }).realizedGainUsd;
}

/**
 * Sums realized P/L from every sell: cash proceeds (`sum` on the sell row) minus average cost of shares sold.
 * Matches the same buy/sell replay as {@link replayTradeTransactionsToHoldings}.
 */
export function cumulativeRealizedGainUsd(transactions: PortfolioTransaction[]): number {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  return replayPortfolioLedger(migrated, { mode: "display" }).realizedGainUsd;
}

/**
 * Realized P/L from sells for one asset only (same average-cost replay as the full ledger, isolated to matching trades).
 */
export function cumulativeRealizedGainUsdForAsset(
  transactions: PortfolioTransaction[],
  routeKey: string,
  assetKind: "stock" | "crypto",
): number {
  const key = routeKey.trim().toUpperCase();
  const filtered = transactions.filter(
    (t) =>
      t.kind === "trade" &&
      portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: key, kind: assetKind }),
  );
  const { transactions: migrated } = migratePortfolioTransactionSequences(filtered);
  return replayPortfolioLedger(migrated, { mode: "display" }).realizedGainUsd;
}

/** Sum of trade row fees (buys, sells, splits) for one asset. */
export function totalTradeFeesUsdForAsset(
  transactions: PortfolioTransaction[],
  routeKey: string,
  assetKind: "stock" | "crypto",
): number {
  const key = routeKey.trim().toUpperCase();
  let s = 0;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (!portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: key, kind: assetKind })) continue;
    if (Number.isFinite(t.fee)) s += t.fee;
  }
  return s;
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
