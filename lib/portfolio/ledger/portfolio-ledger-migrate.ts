/**
 * Assign deterministic `sequence` (and optional synthetic `createdAt`) for legacy rows.
 * Preserves existing array order for same-date groups that lack sequence.
 * Additive / reversible — does not delete or rewrite amounts.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { transactionSequenceOrZero } from "@/lib/portfolio/ledger/portfolio-ledger-order";

export type LedgerSequenceMigrationReport = {
  transactionCount: number;
  missingSequenceBefore: number;
  assignedSequence: number;
  sameDayGroups: number;
  ambiguousSameDayGroups: number;
};

/**
 * Ensures every transaction has a finite `sequence`.
 * Existing sequences are kept; missing ones are assigned from current array order
 * (date groups get contiguous increasing sequences preserving relative order).
 */
export function migratePortfolioTransactionSequences(
  transactions: readonly PortfolioTransaction[],
): { transactions: PortfolioTransaction[]; report: LedgerSequenceMigrationReport; changed: boolean } {
  const missingBefore = transactions.filter((t) => {
    const s = t.sequence;
    return typeof s !== "number" || !Number.isFinite(s);
  }).length;

  // Group by date preserving first-seen array order within each date.
  const byDate = new Map<string, PortfolioTransaction[]>();
  const dateOrder: string[] = [];
  for (const t of transactions) {
    const d = t.date;
    if (!byDate.has(d)) {
      byDate.set(d, []);
      dateOrder.push(d);
    }
    byDate.get(d)!.push(t);
  }

  let sameDayGroups = 0;
  let ambiguousSameDayGroups = 0;
  let seq = 0;
  let assigned = 0;
  let changed = false;
  const out: PortfolioTransaction[] = [];

  for (const d of dateOrder) {
    const group = byDate.get(d)!;
    if (group.length > 1) sameDayGroups++;
    const anyMissing = group.some((t) => typeof t.sequence !== "number" || !Number.isFinite(t.sequence));
    const allHave = group.every((t) => typeof t.sequence === "number" && Number.isFinite(t.sequence));
    if (group.length > 1 && anyMissing) ambiguousSameDayGroups++;

    if (allHave) {
      // Keep existing sequences; still emit rows (may add createdAt later).
      const sorted = [...group].sort((a, b) => transactionSequenceOrZero(a) - transactionSequenceOrZero(b));
      for (const t of sorted) {
        seq = Math.max(seq, transactionSequenceOrZero(t));
        out.push(t);
      }
      continue;
    }

    // Assign sequences preserving current array order within this date.
    for (const t of group) {
      if (typeof t.sequence === "number" && Number.isFinite(t.sequence)) {
        seq = Math.max(seq, t.sequence);
        out.push(t);
        continue;
      }
      seq += 1;
      assigned += 1;
      changed = true;
      const createdAt =
        typeof t.createdAt === "string" && t.createdAt.length > 0
          ? t.createdAt
          : undefined;
      out.push({
        ...t,
        sequence: seq,
        ...(createdAt ? { createdAt } : {}),
      });
    }
  }

  // If some dates had pre-assigned high sequences and others got low ones, re-normalize
  // only when we assigned anything and ordering could conflict across dates.
  // Prefer: global rewrite of missing only is enough because compare uses date first.

  return {
    transactions: out,
    changed: changed || missingBefore > 0,
    report: {
      transactionCount: transactions.length,
      missingSequenceBefore: missingBefore,
      assignedSequence: assigned,
      sameDayGroups,
      ambiguousSameDayGroups,
    },
  };
}

/**
 * Migrates all portfolios in a workspace map. Returns new map + aggregate report.
 */
export function migrateWorkspaceTransactionSequences(
  transactionsByPortfolioId: Record<string, PortfolioTransaction[]>,
): {
  transactionsByPortfolioId: Record<string, PortfolioTransaction[]>;
  changed: boolean;
  reports: Record<string, LedgerSequenceMigrationReport>;
} {
  const out: Record<string, PortfolioTransaction[]> = {};
  const reports: Record<string, LedgerSequenceMigrationReport> = {};
  let changed = false;
  for (const [pid, list] of Object.entries(transactionsByPortfolioId)) {
    const m = migratePortfolioTransactionSequences(list);
    out[pid] = m.transactions;
    reports[pid] = m.report;
    if (m.changed) changed = true;
  }
  return { transactionsByPortfolioId: out, changed, reports };
}
