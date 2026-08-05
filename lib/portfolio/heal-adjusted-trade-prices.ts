import "server-only";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { fetchEodhdEodDailyBothCloses } from "@/lib/market/eodhd-eod";
import { isLikelyAsTradedCloseAfterSplit } from "@/lib/portfolio/is-likely-split-adjusted-close-price";
import {
  equityCoverageFromTransactions,
  isEquitySymbolForStockSplit,
  corporateActionSplitExternalId,
} from "@/lib/portfolio/merge-stock-splits";

function normSym(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/i, "");
}

function recomputeTradeSum(t: PortfolioTransaction, price: number): number {
  const notional = t.shares * price;
  const fee = Number.isFinite(t.fee) && t.fee > 0 ? t.fee : 0;
  const op = t.operation.trim().toLowerCase();
  if (op === "sell") return notional - fee;
  return -(notional + fee);
}

function barOnOrBefore(
  bars: readonly { date: string; close: number; adjustedClose: number }[],
  ymd: string,
): { close: number; adjustedClose: number } | null {
  let pick: { close: number; adjustedClose: number } | null = null;
  for (const b of bars) {
    if (b.date <= ymd) pick = b;
    else break;
  }
  return pick;
}

/** Auto-injected Finsepa Split corporate-actions (not user/import split rows). */
export function isAutoCorporateActionSplit(t: PortfolioTransaction): boolean {
  if (t.kind !== "trade") return false;
  if (t.operation.trim().toLowerCase() !== "split") return false;
  const ext = typeof t.externalId === "string" ? t.externalId : "";
  if (ext.startsWith("finsepa:ca:split:")) return true;
  // Deterministic ids from merge-stock-splits
  if (t.id.startsWith("tx_split_")) return true;
  return false;
}

export function stripAutoCorporateActionSplits(
  transactions: readonly PortfolioTransaction[],
): { transactions: PortfolioTransaction[]; removed: number } {
  const next: PortfolioTransaction[] = [];
  let removed = 0;
  for (const t of transactions) {
    if (isAutoCorporateActionSplit(t)) {
      removed += 1;
      continue;
    }
    next.push(t);
  }
  return { transactions: next, removed };
}

/**
 * Restore continuous/chart-scale prices when trades were rewritten to as-traded unadjusted
 * close after stock splits (inflates cash outflows and share re-base doubles costs).
 */
export async function restoreAdjustedCloseTradePrices(
  transactions: readonly PortfolioTransaction[],
): Promise<{ transactions: PortfolioTransaction[]; changed: number }> {
  const { symbols, fromYmd } = equityCoverageFromTransactions(transactions);
  if (symbols.length === 0 || !fromYmd) {
    return { transactions: [...transactions], changed: 0 };
  }

  const toYmd = new Date().toISOString().slice(0, 10);
  const barsBySymbol = new Map<string, { date: string; close: number; adjustedClose: number }[]>();

  await Promise.all(
    symbols.map(async (symbol) => {
      const bars = await fetchEodhdEodDailyBothCloses(symbol, fromYmd, toYmd);
      if (bars?.length) barsBySymbol.set(symbol, bars);
    }),
  );

  let changed = 0;
  const next = transactions.map((t) => {
    if (t.kind !== "trade") return t;
    const op = t.operation.trim().toLowerCase();
    if (op !== "buy" && op !== "sell") return t;
    if (!isEquitySymbolForStockSplit(t.symbol)) return t;

    const bars = barsBySymbol.get(normSym(t.symbol));
    if (!bars?.length) return t;
    const bar = barOnOrBefore(bars, t.date);
    if (!bar) return t;
    if (!isLikelyAsTradedCloseAfterSplit(t.price, bar.adjustedClose, bar.close)) return t;

    changed += 1;
    const price = bar.adjustedClose;
    return {
      ...t,
      price,
      sum: recomputeTradeSum(t, price),
    };
  });

  return { transactions: next, changed };
}

/** @deprecated Name kept for older imports; continuous-price portfolio model no longer rewrites to as-traded. */
export async function healAdjustedAutofillTradePrices(
  transactions: readonly PortfolioTransaction[],
): Promise<{ transactions: PortfolioTransaction[]; changed: number }> {
  return restoreAdjustedCloseTradePrices(transactions);
}

/** Exported for tests / tooling — ensures CA id format stays stable. */
export function sampleCorporateActionExternalId(symbol: string, date: string): string {
  return corporateActionSplitExternalId(symbol, date);
}
