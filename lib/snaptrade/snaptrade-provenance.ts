/**
 * Row provenance helpers for the shared portfolio ledger.
 *
 * A missing `source` always means `MANUAL` (back-compat with every pre-Phase-5B row).
 * SnapTrade rows (`SNAPTRADE`) and synthetic reconciliation rows (`SNAPTRADE_ADJUSTMENT`)
 * are both treated as broker-immutable for edit/delete purposes.
 *
 * Pure / isomorphic — safe to import from the client and from tests.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export type TransactionSource = "MANUAL" | "SNAPTRADE" | "SNAPTRADE_ADJUSTMENT";

/** Canonical source for a row. Undefined/unknown ⇒ MANUAL. */
export function transactionSource(t: Pick<PortfolioTransaction, "source">): TransactionSource {
  const s = t.source;
  if (s === "SNAPTRADE" || s === "SNAPTRADE_ADJUSTMENT") return s;
  return "MANUAL";
}

/** True for broker-owned rows (real broker imports AND synthetic adjustments). Immutable in UI. */
export function isSnaptradeBrokerRow(t: Pick<PortfolioTransaction, "source">): boolean {
  const s = transactionSource(t);
  return s === "SNAPTRADE" || s === "SNAPTRADE_ADJUSTMENT";
}

/** True for user-owned manual rows (the default). */
export function isManualTransaction(t: Pick<PortfolioTransaction, "source">): boolean {
  return transactionSource(t) === "MANUAL";
}

/**
 * Ensure a row carries an explicit `source`. Missing ⇒ MANUAL. Idempotent: a row that
 * already has a source (or was already normalized) is returned unchanged (same reference).
 */
export function normalizeTransactionProvenance<T extends PortfolioTransaction>(t: T): T {
  if (t.source === "MANUAL" || t.source === "SNAPTRADE" || t.source === "SNAPTRADE_ADJUSTMENT") {
    return t;
  }
  return { ...t, source: "MANUAL" };
}

/**
 * Normalize provenance across a list. Returns the same array reference when nothing changed
 * so callers can cheaply detect no-ops.
 */
export function normalizeTransactionsProvenance<T extends PortfolioTransaction>(
  transactions: readonly T[],
): T[] {
  let changed = false;
  const out = transactions.map((t) => {
    const n = normalizeTransactionProvenance(t);
    if (n !== t) changed = true;
    return n;
  });
  return changed ? out : (transactions as T[]);
}
