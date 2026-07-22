/**
 * Phase 5B safe merge — the ONLY sanctioned way to fold a SnapTrade sync draft into an
 * existing (possibly mixed manual + broker) ledger.
 *
 * Hard guarantees (see docs/PORTFOLIO-PHASE-5-SNAPTRADE-INTEGRATION.md):
 *  1. Every MANUAL row is preserved, always. Sync can never delete a manual transaction.
 *  2. Broker rows (SNAPTRADE + SNAPTRADE_ADJUSTMENT) are upserted by `externalId`.
 *  3. Incremental sync (`replaceMissingBrokerRows` false): existing broker rows NOT in the
 *     incoming draft are preserved (no tombstones).
 *  4. Full-history sync (`replaceMissingBrokerRows` true / Update from = first transaction):
 *     broker ledger is replaced by the incoming draft; stale broker rows are dropped.
 *  5. `updateFromYmd` only bounds which existing broker rows may be REFRESHED from incoming;
 *     it never deletes manual rows.
 *  6. NO cross-source dedupe — a manual row is never dropped because it looks like a broker row.
 *  7. Legacy SnapTrade rows without an `externalId` are matched to incoming ONLY within the
 *     broker source, using a full-precision content fallback key.
 *
 * This replaces the legacy `mergePortfolioSnaptradeSync` (content-hash) path.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  isManualTransaction,
  isSnaptradeBrokerRow,
  normalizeTransactionsProvenance,
} from "@/lib/snaptrade/snaptrade-provenance";

export type MergeSnaptradeSyncStats = {
  manualPreserved: number;
  brokerExistingBefore: number;
  incomingCount: number;
  brokerUpdated: number;
  brokerInserted: number;
  brokerPreserved: number;
  /** Incoming rows skipped because their existing match was outside the update window. */
  brokerSkippedOutsideWindow: number;
  /** Existing broker rows dropped because full-history sync replaced the broker ledger. */
  brokerDropped: number;
};

export type MergeSnaptradeSyncInput = {
  existing: readonly PortfolioTransaction[];
  incoming: readonly PortfolioTransaction[];
  /** yyyy-MM-dd. When set, existing broker rows older than this are never refreshed. */
  updateFromYmd?: string | null;
  /**
   * When true (full history sync / "first transaction"), drop broker rows that are not in
   * the incoming draft. Manual rows are still always preserved.
   * Incremental syncs must leave this false so older history is not deleted.
   */
  replaceMissingBrokerRows?: boolean;
};

export type MergeSnaptradeSyncResult = {
  transactions: PortfolioTransaction[];
  stats: MergeSnaptradeSyncStats;
};

/** Full-precision content key for legacy (no-externalId) broker rows — NEVER rounds. */
function brokerFallbackKey(t: PortfolioTransaction): string {
  return [t.date, t.operation, t.symbol ?? "", t.shares, t.price, t.sum, t.kind].join("|");
}

function kindOrder(k: PortfolioTransaction["kind"]): number {
  return k === "cash" ? 0 : k === "trade" ? 1 : 2;
}

function sortLedger(list: PortfolioTransaction[]): PortfolioTransaction[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return kindOrder(a.kind) - kindOrder(b.kind);
  });
}

/** Merge fields of an incoming broker row onto an existing one, preserving identity + first-import metadata. */
function refreshedRow(existing: PortfolioTransaction, incoming: PortfolioTransaction): PortfolioTransaction {
  return {
    ...incoming,
    id: existing.id,
    portfolioId: existing.portfolioId,
    // Preserve when the row was first imported; stamp the latest sync time.
    importedAt: existing.importedAt ?? incoming.importedAt,
    lastSyncedAt: incoming.lastSyncedAt ?? new Date().toISOString(),
    // Preserve a stable externalId if the existing row already had one and incoming lost it.
    externalId: incoming.externalId ?? existing.externalId,
  };
}

export function mergeSnaptradeSyncSafe(input: MergeSnaptradeSyncInput): MergeSnaptradeSyncResult {
  const updateFromYmd = input.updateFromYmd ?? null;
  const replaceMissingBrokerRows = input.replaceMissingBrokerRows === true;
  const existing = normalizeTransactionsProvenance(input.existing);
  const incoming = normalizeTransactionsProvenance(input.incoming);

  const manual = existing.filter(isManualTransaction);
  const existingBroker = existing.filter(isSnaptradeBrokerRow);

  // Index incoming broker rows for matching.
  const incomingByExtId = new Map<string, PortfolioTransaction>();
  const incomingByFallback = new Map<string, PortfolioTransaction[]>();
  for (const inc of incoming) {
    if (!isSnaptradeBrokerRow(inc)) continue; // incoming should be broker-only; ignore stray rows.
    if (inc.externalId) incomingByExtId.set(inc.externalId, inc);
    const fk = brokerFallbackKey(inc);
    const bucket = incomingByFallback.get(fk);
    if (bucket) bucket.push(inc);
    else incomingByFallback.set(fk, [inc]);
  }

  const used = new Set<PortfolioTransaction>();
  const stats: MergeSnaptradeSyncStats = {
    manualPreserved: manual.length,
    brokerExistingBefore: existingBroker.length,
    incomingCount: incoming.filter(isSnaptradeBrokerRow).length,
    brokerUpdated: 0,
    brokerInserted: 0,
    brokerPreserved: 0,
    brokerSkippedOutsideWindow: 0,
    brokerDropped: 0,
  };

  const resultBroker: PortfolioTransaction[] = [];

  for (const ex of existingBroker) {
    let match: PortfolioTransaction | undefined;
    if (ex.externalId && incomingByExtId.has(ex.externalId)) {
      const candidate = incomingByExtId.get(ex.externalId)!;
      if (!used.has(candidate)) match = candidate;
    } else if (!ex.externalId) {
      // Legacy row: within-source fallback match only.
      const bucket = incomingByFallback.get(brokerFallbackKey(ex));
      match = bucket?.find((c) => !used.has(c));
    }

    if (match) {
      used.add(match);
      const canRefresh = !updateFromYmd || ex.date >= updateFromYmd;
      if (canRefresh) {
        resultBroker.push(refreshedRow(ex, match));
        stats.brokerUpdated += 1;
      } else {
        // Matched but outside the refresh window → keep the existing row as-is.
        resultBroker.push(ex);
        stats.brokerPreserved += 1;
        stats.brokerSkippedOutsideWindow += 1;
      }
    } else if (replaceMissingBrokerRows) {
      // Full-history sync: broker ledger is replaced by the incoming draft.
      stats.brokerDropped += 1;
    } else {
      // Incremental: no incoming counterpart → preserve existing broker row.
      resultBroker.push(ex);
      stats.brokerPreserved += 1;
    }
  }

  // Insert incoming broker rows that matched nothing existing.
  for (const inc of incoming) {
    if (!isSnaptradeBrokerRow(inc)) continue;
    if (used.has(inc)) continue;
    resultBroker.push({
      ...inc,
      importedAt: inc.importedAt ?? new Date().toISOString(),
      lastSyncedAt: inc.lastSyncedAt ?? new Date().toISOString(),
    });
    stats.brokerInserted += 1;
  }

  return {
    transactions: sortLedger([...manual, ...resultBroker]),
    stats,
  };
}
