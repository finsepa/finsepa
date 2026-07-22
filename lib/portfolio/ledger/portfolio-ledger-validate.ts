/**
 * Semantic validation for Manual Portfolio ledgers (shared client + server).
 */

import type {
  PersistedPortfolioState,
} from "@/lib/portfolio/portfolio-storage";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import { replayPortfolioLedger } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import type {
  PortfolioLedgerIssue,
  PortfolioLedgerValidationResult,
} from "@/lib/portfolio/ledger/portfolio-ledger-types";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function fieldIssues(
  t: PortfolioTransaction,
  portfolioId: string,
): PortfolioLedgerIssue[] {
  const out: PortfolioLedgerIssue[] = [];
  if (!t.id?.trim()) {
    out.push({
      code: "MISSING_FIELDS",
      portfolioId,
      transactionId: null,
      message: "Transaction id is required.",
    });
  }
  if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
    out.push({
      code: "MISSING_FIELDS",
      portfolioId,
      transactionId: t.id,
      message: "Transaction date must be YYYY-MM-DD.",
    });
  }
  if (!isFiniteNumber(t.sum)) {
    out.push({
      code: "INVALID_NUMERIC",
      portfolioId,
      transactionId: t.id,
      message: "Transaction sum must be finite.",
    });
  }
  if (!isFiniteNumber(t.shares) || !isFiniteNumber(t.price) || !isFiniteNumber(t.fee)) {
    out.push({
      code: "INVALID_NUMERIC",
      portfolioId,
      transactionId: t.id,
      message: "shares, price, and fee must be finite numbers.",
    });
  }
  if (t.kind !== "trade" && t.kind !== "cash" && t.kind !== "income" && t.kind !== "expense") {
    out.push({
      code: "UNKNOWN_TRANSACTION_KIND",
      portfolioId,
      transactionId: t.id,
      message: `Unknown transaction kind: ${String(t.kind)}`,
    });
  }

  if (t.kind === "trade") {
    const op = t.operation.toLowerCase();
    if (op === "buy" || op === "sell") {
      if (!(t.shares > 0)) {
        out.push({
          code: "INVALID_QUANTITY",
          portfolioId,
          transactionId: t.id,
          message: "Trade quantity must be positive.",
        });
      }
      if (!(t.price > 0)) {
        out.push({
          code: "INVALID_PRICE",
          portfolioId,
          transactionId: t.id,
          message: "Trade price must be positive.",
        });
      }
      if (t.fee < 0) {
        out.push({
          code: "INVALID_FEE",
          portfolioId,
          transactionId: t.id,
          message: "Trade fee must be non-negative.",
        });
      }
      if (!t.symbol?.trim()) {
        out.push({
          code: "MISSING_FIELDS",
          portfolioId,
          transactionId: t.id,
          message: "Trade symbol is required.",
        });
      }
    }
  }
  return out;
}

/**
 * Validate one portfolio's transaction list after sequence migration.
 * `allowLegacyAnomalies`: orphan/oversell on legacyAnomaly rows become warnings.
 */
export function validatePortfolioLedger(
  portfolioId: string,
  transactions: readonly PortfolioTransaction[],
  opts?: { allowLegacyAnomalies?: boolean },
): PortfolioLedgerValidationResult {
  const allowLegacy = opts?.allowLegacyAnomalies !== false;
  const errors: PortfolioLedgerIssue[] = [];
  const warnings: PortfolioLedgerIssue[] = [];

  const ids = new Set<string>();
  for (const t of transactions) {
    if (ids.has(t.id)) {
      errors.push({
        code: "DUPLICATE_TRANSACTION_ID",
        portfolioId,
        transactionId: t.id,
        message: `Duplicate transaction id ${t.id}.`,
      });
    }
    ids.add(t.id);
    for (const issue of fieldIssues(t, portfolioId)) {
      errors.push(issue);
    }
  }

  const migrated = migratePortfolioTransactionSequences(transactions);
  const replay = replayPortfolioLedger(migrated.transactions, {
    mode: "strict",
    portfolioId,
  });

  for (const issue of replay.issues) {
    if (
      allowLegacy &&
      issue.legacy &&
      (issue.code === "SELL_WITHOUT_POSITION" ||
        issue.code === "SELL_EXCEEDS_AVAILABLE_SHARES" ||
        issue.code === "INVALID_SPLIT")
    ) {
      warnings.push(issue);
      continue;
    }
    // If the tx is tagged legacyAnomaly, treat sell anomalies as warnings
    const tx = migrated.transactions.find((x) => x.id === issue.transactionId);
    if (
      allowLegacy &&
      tx?.legacyAnomaly &&
      (issue.code === "SELL_WITHOUT_POSITION" ||
        issue.code === "SELL_EXCEEDS_AVAILABLE_SHARES")
    ) {
      warnings.push({ ...issue, legacy: true });
      continue;
    }
    errors.push(issue);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate a proposed portfolio ledger after add/edit/delete (strict — no new anomalies).
 */
export function validatePortfolioLedgerMutation(
  portfolioId: string,
  nextTransactions: readonly PortfolioTransaction[],
): PortfolioLedgerValidationResult {
  return validatePortfolioLedger(portfolioId, nextTransactions, {
    allowLegacyAnomalies: true,
  });
}

export function validateWorkspaceState(
  state: PersistedPortfolioState,
  opts?: { allowLegacyAnomalies?: boolean; strict?: boolean },
): PortfolioLedgerValidationResult {
  const errors: PortfolioLedgerIssue[] = [];
  const warnings: PortfolioLedgerIssue[] = [];

  const portfolioIds = new Set<string>();
  for (const p of state.portfolios) {
    if (portfolioIds.has(p.id)) {
      errors.push({
        code: "DUPLICATE_PORTFOLIO_ID",
        portfolioId: p.id,
        transactionId: null,
        message: `Duplicate portfolio id ${p.id}.`,
      });
    }
    portfolioIds.add(p.id);
  }

  for (const p of state.portfolios) {
    if (p.kind === "combined") continue;
    const list = state.transactionsByPortfolioId[p.id] ?? [];
    const r = validatePortfolioLedger(p.id, list, {
      allowLegacyAnomalies: opts?.allowLegacyAnomalies !== false,
    });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  const ok = opts?.strict === false ? true : errors.length === 0;
  return { ok, errors, warnings };
}

/** Prepare transactions for append: migrate sequences on existing, stamp new row. */
export function stampNewTransaction(
  existing: readonly PortfolioTransaction[],
  draft: PortfolioTransaction,
): PortfolioTransaction {
  const { transactions } = migratePortfolioTransactionSequences(existing);
  const maxSeq = transactions.reduce((m, t) => {
    const s = typeof t.sequence === "number" && Number.isFinite(t.sequence) ? t.sequence : 0;
    return Math.max(m, s);
  }, 0);
  return {
    ...draft,
    sequence: maxSeq + 1,
    createdAt: draft.createdAt ?? new Date().toISOString(),
  };
}

export function orderedTransactionsForDisplay(
  transactions: readonly PortfolioTransaction[],
): PortfolioTransaction[] {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  return sortPortfolioTransactionsCanonical(migrated);
}
