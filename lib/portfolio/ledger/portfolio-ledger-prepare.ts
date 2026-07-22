/**
 * Lazy migration before persist: sequences + legacy anomaly tags + provenance.
 * Additive only — never deletes transactions.
 */

import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";
import {
  migrateWorkspaceTransactionSequences,
  type LedgerSequenceMigrationReport,
} from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import { tagLegacyAnomalySells } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { normalizeTransactionsProvenance } from "@/lib/snaptrade/snaptrade-provenance";

export type WorkspaceLedgerPrepareReport = {
  sequenceReports: Record<string, LedgerSequenceMigrationReport>;
  legacyTaggedByPortfolio: Record<string, string[]>;
  changed: boolean;
};

export function prepareWorkspaceLedgerForPersist(
  state: PersistedPortfolioState,
): { state: PersistedPortfolioState; report: WorkspaceLedgerPrepareReport } {
  const seq = migrateWorkspaceTransactionSequences(state.transactionsByPortfolioId);
  let changed = seq.changed;
  const legacyTaggedByPortfolio: Record<string, string[]> = {};
  const transactionsByPortfolioId: Record<string, typeof seq.transactionsByPortfolioId[string]> = {
    ...seq.transactionsByPortfolioId,
  };

  for (const p of state.portfolios) {
    if (p.kind === "combined") continue;
    const list = transactionsByPortfolioId[p.id] ?? [];
    const withProvenance = normalizeTransactionsProvenance(list);
    if (withProvenance !== list) changed = true;
    const tagged = tagLegacyAnomalySells(withProvenance, p.id);
    transactionsByPortfolioId[p.id] = tagged.transactions;
    if (tagged.taggedIds.length > 0) {
      legacyTaggedByPortfolio[p.id] = tagged.taggedIds;
      changed = true;
    }
  }

  return {
    state: {
      ...state,
      transactionsByPortfolioId,
    },
    report: {
      sequenceReports: seq.reports,
      legacyTaggedByPortfolio,
      changed,
    },
  };
}
