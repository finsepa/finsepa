/**
 * Canonical Manual Portfolio transaction ordering (Phase 1).
 * Order: date → sequence → id. Sequence is assigned on migration / new writes.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export function transactionSequenceOrZero(t: PortfolioTransaction): number {
  const s = t.sequence;
  return typeof s === "number" && Number.isFinite(s) ? s : 0;
}

/** Stable compare for any two ledger rows (same rules everywhere). */
export function comparePortfolioTransactions(
  a: PortfolioTransaction,
  b: PortfolioTransaction,
): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const sa = transactionSequenceOrZero(a);
  const sb = transactionSequenceOrZero(b);
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

/** Returns a new array sorted in canonical order (does not mutate). */
export function sortPortfolioTransactionsCanonical(
  transactions: readonly PortfolioTransaction[],
): PortfolioTransaction[] {
  return [...transactions].sort(comparePortfolioTransactions);
}

/** Next sequence for a new row in this portfolio (monotonic). */
export function nextPortfolioTransactionSequence(
  transactions: readonly PortfolioTransaction[],
): number {
  let max = 0;
  for (const t of transactions) {
    const s = transactionSequenceOrZero(t);
    if (s > max) max = s;
  }
  return max + 1;
}
