import "server-only";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { fetchEodhdEodDailyBothCloses } from "@/lib/market/eodhd-eod";
import {
  equityCoverageFromTransactions,
  isEquitySymbolForStockSplit,
  corporateActionSplitExternalId,
} from "@/lib/portfolio/merge-stock-splits";
import { restoreTradeToAdjustedCloseScale } from "@/lib/portfolio/restore-trade-adjusted-scale";

function normSym(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/i, "");
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
 * Restore continuous/chart-scale prices when fills match as-traded unadjusted closes
 * after later stock splits. Scales shares with the price so cost basis is preserved
 * (avoids 4 @ $330 → 4 @ $33 destroying 10× of cost).
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
    const restored = restoreTradeToAdjustedCloseScale(t, bar);
    if (!restored) return t;
    changed += 1;
    return restored;
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
