import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { normalizeSplitRatio, parseEodhdSplitRatioLabel } from "@/lib/market/parse-eodhd-split-ratio";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import {
  nextPortfolioTransactionSequence,
  sortPortfolioTransactionsCanonical,
} from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";

export type StockSplitEvent = {
  symbol: string;
  /** Ex-split / effective date `yyyy-MM-dd`. */
  date: string;
  /** New shares per 1 old share (e.g. 10 for 10:1; 0.5 for 1:2 reverse). */
  ratio: number;
  name?: string;
};

function normSym(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/i, "");
}

function isCashLike(symbol: string): boolean {
  const s = normSym(symbol);
  return s === "USD" || s === "CASH" || s === "US DOLLAR";
}

/** Equities only — crypto has different corporate-action handling. */
export function isEquitySymbolForStockSplit(symbol: string): boolean {
  if (!symbol.trim() || isCashLike(symbol)) return false;
  if (isSupportedCryptoAssetSymbol(cryptoRouteBase(symbol))) return false;
  return true;
}

export function previousCalendarDayYmd(ymd: string): string {
  const [ys, ms, ds] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function corporateActionSplitTransactionId(
  portfolioId: string,
  symbol: string,
  date: string,
): string {
  const sym = normSym(symbol).replace(/[^A-Z0-9]/g, "");
  return `tx_split_${portfolioId}_${sym}_${date}`;
}

export function corporateActionSplitExternalId(symbol: string, date: string): string {
  return `finsepa:ca:split:${normSym(symbol)}:${date}`;
}

function formatSplitLabel(ratio: number): string {
  if (ratio > 1) {
    const r = Math.round(ratio * 1e6) / 1e6;
    return Number.isInteger(r) ? `${r}:1` : `${r}:1`;
  }
  const inv = 1 / ratio;
  if (Number.isFinite(inv) && Math.abs(inv - Math.round(inv)) < 1e-6) {
    return `1:${Math.round(inv)}`;
  }
  return String(ratio);
}

function hasSplitRecorded(
  transactions: readonly PortfolioTransaction[],
  symbol: string,
  date: string,
): boolean {
  const sym = normSym(symbol);
  const externalId = corporateActionSplitExternalId(sym, date);
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.operation.trim().toLowerCase() !== "split") continue;
    if (normSym(t.symbol) !== sym) continue;
    if (t.date === date) return true;
    if (t.externalId === externalId) return true;
  }
  return false;
}

/**
 * Build Split ledger rows for corporate actions that touch open positions.
 * Pure / client-safe — does not fetch market data.
 *
 * Idempotent: skips symbols that already have a Split on that date (or matching external id).
 */
export function buildMissingSplitTransactions(args: {
  portfolioId: string;
  transactions: readonly PortfolioTransaction[];
  events: readonly StockSplitEvent[];
}): PortfolioTransaction[] {
  const { portfolioId, events } = args;
  let working = sortPortfolioTransactionsCanonical(args.transactions);
  const added: PortfolioTransaction[] = [];

  const sortedEvents = [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return normSym(a.symbol).localeCompare(normSym(b.symbol));
  });

  for (const ev of sortedEvents) {
    const ratio = normalizeSplitRatio(ev.ratio);
    if (ratio == null) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
    if (!isEquitySymbolForStockSplit(ev.symbol)) continue;

    const symbol = normSym(ev.symbol);
    if (hasSplitRecorded(working, symbol, ev.date)) continue;

    const asOf = previousCalendarDayYmd(ev.date);
    const holds = replayTradeTransactionsToHoldingsUpTo(working, asOf);
    const pos = holds.find((h) => normSym(h.symbol) === symbol);
    if (!pos || !(pos.shares > 1e-12)) continue;

    const id = corporateActionSplitTransactionId(portfolioId, symbol, ev.date);
    if (working.some((t) => t.id === id)) continue;

    const row: PortfolioTransaction = {
      id,
      portfolioId,
      kind: "trade",
      operation: "Split",
      symbol,
      name: (ev.name?.trim() || pos.name || symbol).trim() || symbol,
      logoUrl: displayLogoUrlForPortfolioSymbol(pos.symbol || symbol) || pos.logoUrl || null,
      date: ev.date,
      shares: 0,
      price: ratio,
      fee: 0,
      sum: 0,
      profitPct: null,
      profitUsd: null,
      sequence: nextPortfolioTransactionSequence(working),
      note: `Stock split ${formatSplitLabel(ratio)}`,
      externalId: corporateActionSplitExternalId(symbol, ev.date),
    };

    working = sortPortfolioTransactionsCanonical([...working, row]);
    added.push(row);
  }

  return added;
}

/** Map EODHD split history rows into events for {@link buildMissingSplitTransactions}. */
export function stockSplitEventsFromEodhdRows(
  symbol: string,
  rows: readonly { date: string; split: string }[],
  name?: string,
): StockSplitEvent[] {
  const out: StockSplitEvent[] = [];
  for (const r of rows) {
    const ratio = parseEodhdSplitRatioLabel(r.split);
    if (ratio == null) continue;
    out.push({
      symbol,
      date: r.date,
      ratio,
      ...(name ? { name } : {}),
    });
  }
  return out;
}

/** Equity trade symbols that may need corporate-action coverage, plus earliest trade date. */
export function equityCoverageFromTransactions(
  transactions: readonly PortfolioTransaction[],
): { symbols: string[]; fromYmd: string | null } {
  const symbols = new Set<string>();
  let fromYmd: string | null = null;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    const op = t.operation.trim().toLowerCase();
    if (op !== "buy" && op !== "sell") continue;
    if (!isEquitySymbolForStockSplit(t.symbol)) continue;
    const sym = normSym(t.symbol);
    symbols.add(sym);
    if (!fromYmd || t.date < fromYmd) fromYmd = t.date;
  }
  return { symbols: [...symbols].sort(), fromYmd };
}
