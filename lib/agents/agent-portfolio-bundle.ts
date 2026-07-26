/**
 * Agent portfolio reads — Supabase workspace + pure local math only.
 * NEVER import EODHD / live quote fetchers here.
 */
import "server-only";

import type {
  PortfolioEntry,
  PortfolioHolding,
  PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { portfolioIsCombined } from "@/components/portfolio/portfolio-types";
import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { mergeHoldingsBySymbol, mergeTransactionsSorted } from "@/lib/portfolio/merge-combined-portfolio";
import {
  equityMarketValue,
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalCostBasisInvested,
  totalNetWorth,
  unrealizedProfitPct,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
import { buildPortfolioAllocationRows } from "@/lib/portfolio/portfolio-allocation-rows";
import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";
import { parsePersistedPortfolioUnknown } from "@/lib/portfolio/portfolio-storage";
import { computePortfolioTurnover } from "@/lib/portfolio/analytics/portfolio-turnover";
import {
  cumulativeRealizedGainUsd,
  lifetimeEquityProfitUsd,
} from "@/lib/portfolio/realized-pnl-from-trades";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MARKS_NOTE =
  "Dollar marks use last saved prices in the portfolio workspace (may be stale). Agent does not call live market-data APIs.";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

export type AgentPortfolioWorkspace = {
  state: PersistedPortfolioState;
  updatedAt: string | null;
};

export async function loadAgentPortfolioWorkspace(
  userId: string,
): Promise<
  | { ok: true; workspace: AgentPortfolioWorkspace }
  | { ok: false; error: string; openInApp: "/portfolio" }
  | { ok: true; empty: true; openInApp: "/portfolio"; note: string }
> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_workspace")
    .select("state,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not load portfolio workspace.", openInApp: "/portfolio" };
  }
  if (!data?.state) {
    return {
      ok: true,
      empty: true,
      openInApp: "/portfolio",
      note: "No saved portfolio workspace yet.",
    };
  }

  const state = parsePersistedPortfolioUnknown(data.state);
  if (!state) {
    return { ok: false, error: "Portfolio data is invalid.", openInApp: "/portfolio" };
  }

  return {
    ok: true,
    workspace: {
      state,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    },
  };
}

function resolvePortfolioEntry(
  state: PersistedPortfolioState,
  portfolioQuery?: string | null,
): PortfolioEntry | null {
  const list = state.portfolios;
  if (list.length === 0) return null;
  const q = portfolioQuery?.trim();
  if (q) {
    const byId = list.find((p) => p.id === q);
    if (byId) return byId;
    const lower = q.toLowerCase();
    const byName = list.find((p) => p.name.trim().toLowerCase() === lower);
    if (byName) return byName;
    const partial = list.find((p) => p.name.trim().toLowerCase().includes(lower));
    if (partial) return partial;
  }
  if (state.selectedPortfolioId) {
    const selected = list.find((p) => p.id === state.selectedPortfolioId);
    if (selected) return selected;
  }
  return list[0] ?? null;
}

export function resolveAgentPortfolioSlice(
  state: PersistedPortfolioState,
  portfolioQuery?: string | null,
): {
  portfolio: PortfolioEntry;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
} | null {
  const portfolio = resolvePortfolioEntry(state, portfolioQuery);
  if (!portfolio) return null;

  if (portfolioIsCombined(portfolio)) {
    const from = portfolio.combinedFrom ?? [];
    const listsH = from.map((id) => state.holdingsByPortfolioId[id] ?? []);
    const listsT = from.map((id) => state.transactionsByPortfolioId[id] ?? []);
    return {
      portfolio,
      holdings: mergeHoldingsBySymbol(listsH),
      transactions: mergeTransactionsSorted(listsT),
    };
  }

  return {
    portfolio,
    holdings: state.holdingsByPortfolioId[portfolio.id] ?? [],
    transactions: state.transactionsByPortfolioId[portfolio.id] ?? [],
  };
}

function holdingAssetKind(symbol: string): "crypto" | "stock" {
  return toSupportedCryptoTicker(symbol) ? "crypto" : "stock";
}

function serializeHolding(h: PortfolioHolding, totalMv: number) {
  const shares = Number.isFinite(h.shares) ? h.shares : 0;
  const currentValueUsd =
    Number.isFinite(h.currentValue) && h.currentValue > 0 ? round2(h.currentValue) : null;
  const marketPriceUsd =
    Number.isFinite(h.marketPrice) && h.marketPrice > 0 ? round2(h.marketPrice) : null;
  const costBasisUsd = Number.isFinite(h.costBasis) ? round2(h.costBasis) : null;
  const avgPriceUsd = Number.isFinite(h.avgPrice) ? round2(h.avgPrice) : null;
  const unrealizedUsd =
    currentValueUsd != null && costBasisUsd != null ? round2(currentValueUsd - costBasisUsd) : null;
  const weightPct =
    currentValueUsd != null && totalMv > 0 ? roundPct((currentValueUsd / totalMv) * 100) : null;

  return {
    symbol: h.symbol,
    name: h.name || null,
    kind: holdingAssetKind(h.symbol),
    shares,
    avgPriceUsd,
    costBasisUsd,
    marketPriceUsd,
    currentValueUsd,
    unrealizedUsd,
    weightPct,
  };
}

export function buildAgentPortfolioSummary(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  holdingsLimit?: number;
}) {
  const { state, updatedAt } = args.workspace;
  const slice = resolveAgentPortfolioSlice(state, args.portfolioQuery);
  const limit = Math.min(Math.max(args.holdingsLimit ?? 40, 1), 60);

  const catalog = state.portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind ?? "standard",
    privacy: p.privacy,
    snaptradeLinked: Boolean(p.snaptrade?.authorizationId),
    combinedFrom: portfolioIsCombined(p) ? (p.combinedFrom ?? []) : undefined,
    holdingCount: portfolioIsCombined(p)
      ? mergeHoldingsBySymbol((p.combinedFrom ?? []).map((id) => state.holdingsByPortfolioId[id] ?? [])).length
      : (state.holdingsByPortfolioId[p.id] ?? []).length,
    transactionCount: portfolioIsCombined(p)
      ? mergeTransactionsSorted((p.combinedFrom ?? []).map((id) => state.transactionsByPortfolioId[id] ?? []))
          .length
      : (state.transactionsByPortfolioId[p.id] ?? []).length,
  }));

  if (!slice) {
    return {
      ok: true as const,
      updatedAt,
      openInApp: "/portfolio" as const,
      portfolios: catalog,
      note: "No portfolios in workspace.",
    };
  }

  const { portfolio, holdings, transactions } = slice;
  const cashUsd = normalizeUsdForDisplay(netCashUsd(transactions));
  const equityUsd = normalizeUsdForDisplay(equityMarketValue(holdings));
  const investedUsd = normalizeUsdForDisplay(totalCostBasisInvested(holdings));
  const unrealizedUsd = normalizeUsdForDisplay(unrealizedProfitUsd(holdings));
  const unrealizedPct = unrealizedProfitPct(holdings);
  const realizedUsd = normalizeUsdForDisplay(cumulativeRealizedGainUsd(transactions));
  const lifetimeProfitUsd = normalizeUsdForDisplay(lifetimeEquityProfitUsd(holdings, transactions));
  const lifetimeProfitPct = lifetimeEquityProfitPct(holdings, transactions);
  const netWorthUsd = normalizeUsdForDisplay(totalNetWorth(holdings, cashUsd));
  const allocationDenom = equityUsd + Math.max(0, cashUsd);

  const cryptoHoldings = holdings.filter((h) => holdingAssetKind(h.symbol) === "crypto");
  const stockHoldings = holdings.filter((h) => holdingAssetKind(h.symbol) === "stock");
  const cryptoUsd = normalizeUsdForDisplay(equityMarketValue(cryptoHoldings));
  const stockUsd = normalizeUsdForDisplay(equityMarketValue(stockHoldings));

  const asOfYmd = new Date().toISOString().slice(0, 10);
  const turnover = computePortfolioTurnover({
    transactions,
    averageEquityUsd: Math.max(equityUsd, 0),
    asOfYmd,
  });

  const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  const holdingsOut = sorted.slice(0, limit).map((h) => serializeHolding(h, allocationDenom));

  return {
    ok: true as const,
    updatedAt,
    openInApp: "/portfolio" as const,
    portfolios: catalog,
    selected: {
      id: portfolio.id,
      name: portfolio.name,
      kind: portfolio.kind ?? "standard",
      privacy: portfolio.privacy,
      snaptradeLinked: Boolean(portfolio.snaptrade?.authorizationId),
      combinedFrom: portfolioIsCombined(portfolio) ? portfolio.combinedFrom : undefined,
    },
    overview: {
      netWorthUsd: round2(netWorthUsd),
      equityMarketValueUsd: round2(equityUsd),
      cashUsd: round2(cashUsd),
      investedCostBasisUsd: round2(investedUsd),
      unrealizedProfitUsd: round2(unrealizedUsd),
      unrealizedProfitPct: unrealizedPct != null ? roundPct(unrealizedPct) : null,
      realizedProfitUsd: round2(realizedUsd),
      lifetimeEquityProfitUsd: round2(lifetimeProfitUsd),
      lifetimeEquityProfitPct: lifetimeProfitPct != null ? roundPct(lifetimeProfitPct) : null,
      stockValueUsd: round2(stockUsd),
      cryptoValueUsd: round2(cryptoUsd),
      holdingCount: holdings.length,
      transactionCount: transactions.length,
      turnoverTrailing1YPct:
        turnover.status === "available" && typeof turnover.value === "number"
          ? roundPct(turnover.value)
          : null,
    },
    holdings: holdingsOut,
    note: MARKS_NOTE,
  };
}

export function buildAgentPortfolioCash(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  limit?: number;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 80);
  const cashUsd = round2(normalizeUsdForDisplay(netCashUsd(slice.transactions)));
  const cashRows = slice.transactions
    .filter((t) => t.kind === "cash")
    .slice(0, limit)
    .map((t) => ({
      date: t.date,
      operation: t.operation,
      sumUsd: round2(t.sum),
      note: t.note?.trim() || null,
    }));

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    cashUsd,
    movements: cashRows,
    note: "Cash balance is the sum of all ledger rows (trades + cash + income + expenses).",
  };
}

export function buildAgentPortfolioTransactions(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  symbol?: string | null;
  kind?: "trade" | "cash" | "income" | "expense" | "all";
  limit?: number;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 100);
  const kind = args.kind ?? "all";
  const sym = args.symbol?.trim().toUpperCase() || null;

  let rows = slice.transactions;
  if (kind !== "all") rows = rows.filter((t) => t.kind === kind);
  if (sym) rows = rows.filter((t) => t.symbol.trim().toUpperCase() === sym);

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    filter: { kind, symbol: sym },
    count: rows.length,
    transactions: rows.slice(0, limit).map((t) => ({
      date: t.date,
      kind: t.kind,
      operation: t.operation,
      symbol: t.symbol || null,
      name: t.name || null,
      shares: Number.isFinite(t.shares) ? t.shares : null,
      priceUsd: Number.isFinite(t.price) ? round2(t.price) : null,
      feeUsd: Number.isFinite(t.fee) ? round2(t.fee) : null,
      sumUsd: round2(t.sum),
      profitUsd:
        t.profitUsd != null && Number.isFinite(t.profitUsd) ? round2(t.profitUsd) : null,
      note: t.note?.trim() || null,
    })),
    note: "From saved transaction ledger only — not a brokerage live sync.",
  };
}

export function buildAgentPortfolioAllocation(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }
  const rows = buildPortfolioAllocationRows(slice.holdings, slice.transactions);
  const cashUsd = round2(normalizeUsdForDisplay(netCashUsd(slice.transactions)));
  const equityUsd = round2(normalizeUsdForDisplay(equityMarketValue(slice.holdings)));

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    equityMarketValueUsd: equityUsd,
    cashUsd,
    slices: rows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      weightPct: roundPct(r.weightPct),
    })),
    note: MARKS_NOTE,
  };
}

export function buildAgentPortfolioIncome(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  limit?: number;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);
  const income = slice.transactions.filter((t) => t.kind === "income");
  const expenses = slice.transactions.filter((t) => t.kind === "expense");
  const incomeTotalUsd = round2(income.reduce((s, t) => s + t.sum, 0));
  const expenseTotalUsd = round2(expenses.reduce((s, t) => s + t.sum, 0));
  const dividends = income.filter((t) => /dividend/i.test(t.operation));
  const dividendTotalUsd = round2(dividends.reduce((s, t) => s + t.sum, 0));

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    totals: {
      recordedIncomeUsd: incomeTotalUsd,
      recordedDividendsUsd: dividendTotalUsd,
      recordedExpensesUsd: expenseTotalUsd,
    },
    recentIncome: income.slice(0, limit).map((t) => ({
      date: t.date,
      operation: t.operation,
      symbol: t.symbol || null,
      sumUsd: round2(t.sum),
      note: t.note?.trim() || null,
    })),
    recentExpenses: expenses.slice(0, Math.min(limit, 40)).map((t) => ({
      date: t.date,
      operation: t.operation,
      symbol: t.symbol || null,
      sumUsd: round2(t.sum),
      note: t.note?.trim() || null,
    })),
    note: "Recorded ledger income/expenses only — not an upcoming dividend calendar (that would need market data).",
  };
}
