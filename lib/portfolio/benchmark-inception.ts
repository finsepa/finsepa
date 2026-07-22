import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

/** Earliest calendar day of a stock buy (YYYY-MM-DD). */
export function earliestStockBuyYmd(transactions: PortfolioTransaction[]): string | null {
  let min: string | null = null;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.operation.toLowerCase() !== "buy") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (min == null || t.date < min) min = t.date;
  }
  return min;
}

/**
 * Replay trades up to and including {@link asOfYmd} (inclusive); returns shares held per symbol.
 */
export function replayStockSharesUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): Map<string, number> {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  const trades = sortPortfolioTransactionsCanonical(
    migrated.filter((t) => t.kind === "trade" && t.date <= asOfYmd),
  );

  const m = new Map<string, number>();
  for (const t of trades) {
    const sym = t.symbol.toUpperCase();
    const prev = m.get(sym) ?? 0;
    const op = t.operation.toLowerCase();
    if (op === "buy") {
      m.set(sym, prev + t.shares);
    } else if (op === "split") {
      const ratio = splitRatioFromTransaction(t);
      if (prev > 0 && ratio != null) m.set(sym, prev * ratio);
    } else if (op === "sell") {
      m.set(sym, Math.max(0, prev - t.shares));
    }
  }
  return m;
}

/**
 * Net cash contributed to equity positions **after** {@link afterYmd} (exclusive of that day).
 * Buy rows use negative `sum` (cash out); sells positive.
 *
 * @deprecated Not for portfolio NAV Modified Dietz. External capital flows are `kind === "cash"`
 * only — see `@/lib/portfolio/returns/portfolio-return-engine`.
 */
export function netCashIntoEquityAfter(transactions: PortfolioTransaction[], afterYmd: string): number {
  let f = 0;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.date <= afterYmd) continue;
    f += -t.sum;
  }
  return f;
}

/**
 * Mid-point Modified Dietz (legacy). Production period returns use day-weighted Dietz in
 * `@/lib/portfolio/returns/modified-dietz`.
 */
export { modifiedDietzMidpointPct as modifiedDietzReturnPct } from "@/lib/portfolio/returns/modified-dietz";
