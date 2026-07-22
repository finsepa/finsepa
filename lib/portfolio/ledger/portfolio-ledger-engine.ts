/**
 * Pure Manual Portfolio ledger engine — single replay path for holdings, cash, realized P/L.
 * Phase 1: deterministic order; strict sells (no silent clamp) unless legacyAnomaly.
 */

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { applyStockSplitToHolding } from "@/lib/portfolio/apply-stock-split-to-holding";
import { mergeBuyIntoPosition, type BuyLot } from "@/lib/portfolio/holding-position";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import type { PortfolioLedgerIssue } from "@/lib/portfolio/ledger/portfolio-ledger-types";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";

const QTY_EPS = 1e-9;

export type LedgerReplayMode = "strict" | "display";

export type LedgerReplayResult = {
  holdings: PortfolioHolding[];
  cashUsd: number;
  realizedGainUsd: number;
  openCostBasisUsd: number;
  ordered: PortfolioTransaction[];
  issues: PortfolioLedgerIssue[];
  /** True when replay completed without blocking errors (display mode may still warn). */
  ok: boolean;
};

function deterministicHoldingId(symbol: string, preferred?: string | null): string {
  if (preferred && preferred.trim()) return preferred;
  return `h:${symbol.toUpperCase()}`;
}

function applySellExact(
  h: PortfolioHolding,
  sharesSold: number,
): { next: PortfolioHolding | null; costRemoved: number } {
  const costRemoved = (sharesSold / h.shares) * h.costBasis;
  const newShares = h.shares - sharesSold;
  if (newShares < QTY_EPS) {
    return { next: null, costRemoved: h.costBasis };
  }
  const newCost = h.costBasis - costRemoved;
  return {
    next: {
      ...h,
      shares: newShares,
      costBasis: newCost,
      avgPrice: newCost / newShares,
      currentValue: newShares * h.marketPrice,
    },
    costRemoved,
  };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Replay the full ledger (or through asOfYmd inclusive).
 * - strict: orphan/oversell → issue + stop applying that sell (state unchanged for that op)
 * - display: legacyAnomaly sells keep Phase-0 soft behavior (skip orphan / clamp oversell)
 */
export function replayPortfolioLedger(
  transactions: readonly PortfolioTransaction[],
  opts?: {
    mode?: LedgerReplayMode;
    portfolioId?: string;
    asOfYmd?: string;
  },
): LedgerReplayResult {
  const mode = opts?.mode ?? "strict";
  const portfolioId = opts?.portfolioId ?? transactions[0]?.portfolioId ?? "";
  const asOf = opts?.asOfYmd;

  const filtered =
    asOf != null
      ? transactions.filter((t) => t.date <= asOf)
      : [...transactions];

  const ordered = sortPortfolioTransactionsCanonical(filtered);
  const bySymbol = new Map<string, PortfolioHolding>();
  const issues: PortfolioLedgerIssue[] = [];
  let realizedGainUsd = 0;
  let cashUsd = 0;
  let blocking = false;

  for (const t of ordered) {
    if (!isFiniteNumber(t.sum)) {
      issues.push({
        code: "INVALID_NUMERIC",
        portfolioId,
        transactionId: t.id,
        message: "Transaction sum is not a finite number.",
      });
      blocking = true;
      continue;
    }
    cashUsd += t.sum;

    if (t.kind !== "trade") continue;

    const sym = t.symbol.trim().toUpperCase();
    const op = t.operation.toLowerCase();
    const existing = bySymbol.get(sym) ?? null;
    const legacy = t.legacyAnomaly === true;

    if (op === "buy") {
      if (!isFiniteNumber(t.shares) || t.shares <= 0) {
        issues.push({
          code: "INVALID_QUANTITY",
          portfolioId,
          transactionId: t.id,
          message: "Buy quantity must be a positive finite number.",
        });
        blocking = true;
        continue;
      }
      if (!isFiniteNumber(t.price) || t.price <= 0) {
        issues.push({
          code: "INVALID_PRICE",
          portfolioId,
          transactionId: t.id,
          message: "Buy price must be a positive finite number.",
        });
        blocking = true;
        continue;
      }
      if (!isFiniteNumber(t.fee) || t.fee < 0) {
        issues.push({
          code: "INVALID_FEE",
          portfolioId,
          transactionId: t.id,
          message: "Buy fee must be a non-negative finite number.",
        });
        blocking = true;
        continue;
      }
      const lot: BuyLot = {
        id: deterministicHoldingId(sym, existing?.id ?? t.holdingId),
        symbol: sym,
        name: t.name,
        logoUrl: t.logoUrl,
        shares: t.shares,
        price: t.price,
        fee: t.fee,
        marketPrice: t.price,
      };
      bySymbol.set(sym, mergeBuyIntoPosition(existing, lot));
      continue;
    }

    if (op === "split") {
      if (!existing) {
        if (mode === "strict" && !legacy) {
          issues.push({
            code: "INVALID_SPLIT",
            portfolioId,
            transactionId: t.id,
            message: "Split without an open position.",
          });
          blocking = true;
        } else {
          issues.push({
            code: "INVALID_SPLIT",
            portfolioId,
            transactionId: t.id,
            message: "Split without an open position (legacy/display skipped).",
            legacy: true,
          });
        }
        continue;
      }
      const ratio = splitRatioFromTransaction(t);
      if (ratio == null || !(ratio > 0)) {
        issues.push({
          code: "INVALID_SPLIT",
          portfolioId,
          transactionId: t.id,
          message: "Split ratio is missing or invalid.",
        });
        blocking = true;
        continue;
      }
      const next = applyStockSplitToHolding(existing, ratio);
      if (next) bySymbol.set(sym, next);
      continue;
    }

    if (op === "sell") {
      if (!isFiniteNumber(t.shares) || t.shares <= 0) {
        issues.push({
          code: "INVALID_QUANTITY",
          portfolioId,
          transactionId: t.id,
          message: "Sell quantity must be a positive finite number.",
        });
        blocking = true;
        continue;
      }
      if (!isFiniteNumber(t.price) || t.price <= 0) {
        issues.push({
          code: "INVALID_PRICE",
          portfolioId,
          transactionId: t.id,
          message: "Sell price must be a positive finite number.",
        });
        blocking = true;
        continue;
      }
      if (!isFiniteNumber(t.fee) || t.fee < 0) {
        issues.push({
          code: "INVALID_FEE",
          portfolioId,
          transactionId: t.id,
          message: "Sell fee must be a non-negative finite number.",
        });
        blocking = true;
        continue;
      }

      if (!existing || existing.shares <= QTY_EPS) {
        const issue: PortfolioLedgerIssue = {
          code: "SELL_WITHOUT_POSITION",
          portfolioId,
          transactionId: t.id,
          message: `Sell of ${sym} with no open position.`,
          legacy: legacy || mode === "display",
        };
        issues.push(issue);
        if (mode === "strict" && !legacy) blocking = true;
        continue;
      }

      if (t.shares - existing.shares > QTY_EPS) {
        const issue: PortfolioLedgerIssue = {
          code: "SELL_EXCEEDS_AVAILABLE_SHARES",
          portfolioId,
          transactionId: t.id,
          message: `Sell ${t.shares} ${sym} exceeds available ${existing.shares}.`,
          legacy: legacy || mode === "display",
        };
        issues.push(issue);
        if (mode === "strict" && !legacy) {
          blocking = true;
          continue;
        }
        // Display / legacyAnomaly: clamp like Phase 0
        const sold = Math.min(t.shares, existing.shares);
        const { next, costRemoved } = applySellExact(existing, sold);
        const proceedsUsed =
          Number.isFinite(t.sum) && t.shares > 0 ? (t.sum * sold) / t.shares : t.sum;
        realizedGainUsd += (Number.isFinite(proceedsUsed) ? proceedsUsed : 0) - costRemoved;
        if (next) bySymbol.set(sym, next);
        else bySymbol.delete(sym);
        continue;
      }

      const { next, costRemoved } = applySellExact(existing, t.shares);
      realizedGainUsd += t.sum - costRemoved;
      if (next) bySymbol.set(sym, next);
      else bySymbol.delete(sym);
      continue;
    }
  }

  const holdings = [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const openCostBasisUsd = holdings.reduce((s, h) => s + h.costBasis, 0);

  return {
    holdings,
    cashUsd,
    realizedGainUsd,
    openCostBasisUsd,
    ordered,
    issues,
    ok: !blocking,
  };
}

/** Tag orphan/oversell sells discovered under display replay (additive flag only). */
export function tagLegacyAnomalySells(
  transactions: readonly PortfolioTransaction[],
  portfolioId: string,
): { transactions: PortfolioTransaction[]; taggedIds: string[] } {
  const result = replayPortfolioLedger(transactions, { mode: "display", portfolioId });
  const bad = new Set(
    result.issues
      .filter(
        (i) =>
          i.code === "SELL_WITHOUT_POSITION" || i.code === "SELL_EXCEEDS_AVAILABLE_SHARES",
      )
      .map((i) => i.transactionId)
      .filter((id): id is string => !!id),
  );
  if (bad.size === 0) {
    return { transactions: [...transactions], taggedIds: [] };
  }
  const taggedIds: string[] = [];
  const next = transactions.map((t) => {
    if (!bad.has(t.id) || t.legacyAnomaly) return t;
    taggedIds.push(t.id);
    return { ...t, legacyAnomaly: true };
  });
  return { transactions: next, taggedIds };
}
