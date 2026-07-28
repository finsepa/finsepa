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

function portfolioCatalog(state: PersistedPortfolioState) {
  return state.portfolios.map((p) => ({
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
}

/** Catalog of portfolios only — no holdings payload. */
export function buildAgentPortfolioList(args: { workspace: AgentPortfolioWorkspace }) {
  const { state, updatedAt } = args.workspace;
  const portfolios = portfolioCatalog(state);
  const selected = resolvePortfolioEntry(state, null);

  return {
    ok: true as const,
    updatedAt,
    openInApp: "/portfolio" as const,
    portfolioCount: portfolios.length,
    selectedPortfolioId: selected?.id ?? state.selectedPortfolioId ?? null,
    selectedPortfolioName: selected?.name ?? null,
    portfolios,
    note: "Portfolio catalog from saved workspace — no live prices.",
  };
}

/**
 * Concentration from saved marks — top weights, cash %, stock vs crypto, top-N share.
 * Pure local math (no market APIs).
 */
export function buildAgentPortfolioConcentration(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  topN?: number;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }

  const topN = Math.min(Math.max(args.topN ?? 5, 1), 20);
  const cashUsd = normalizeUsdForDisplay(netCashUsd(slice.transactions));
  const equityUsd = normalizeUsdForDisplay(equityMarketValue(slice.holdings));
  const netWorth = equityUsd + cashUsd;
  const allocationDenom = equityUsd + Math.max(0, cashUsd);

  const cryptoHoldings = slice.holdings.filter((h) => holdingAssetKind(h.symbol) === "crypto");
  const stockHoldings = slice.holdings.filter((h) => holdingAssetKind(h.symbol) === "stock");
  const cryptoUsd = normalizeUsdForDisplay(equityMarketValue(cryptoHoldings));
  const stockUsd = normalizeUsdForDisplay(equityMarketValue(stockHoldings));

  const rows = [...slice.holdings]
    .map((h) => serializeHolding(h, allocationDenom))
    .filter((h) => h.weightPct != null && h.weightPct > 0)
    .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0));

  const topHoldings = rows.slice(0, topN);
  const topWeightPct = roundPct(topHoldings.reduce((s, h) => s + (h.weightPct ?? 0), 0));
  const cashWeightPct = allocationDenom > 0 ? roundPct((Math.max(0, cashUsd) / allocationDenom) * 100) : null;
  const equityWeightPct =
    allocationDenom > 0 ? roundPct((Math.max(0, equityUsd) / allocationDenom) * 100) : null;

  // Herfindahl–Hirschman on equity+cash weights (0–10_000 scale), informational only.
  const hhi = round2(
    rows.reduce((s, h) => {
      const w = h.weightPct ?? 0;
      return s + w * w;
    }, 0) + (cashWeightPct != null ? cashWeightPct * cashWeightPct : 0),
  );

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    totals: {
      netWorthUsd: round2(normalizeUsdForDisplay(netWorth)),
      equityMarketValueUsd: round2(equityUsd),
      cashUsd: round2(cashUsd),
      cashWeightPct,
      equityWeightPct,
      stockValueUsd: round2(stockUsd),
      cryptoValueUsd: round2(cryptoUsd),
      stockWeightOfEquityPct: equityUsd > 0 ? roundPct((stockUsd / equityUsd) * 100) : null,
      cryptoWeightOfEquityPct: equityUsd > 0 ? roundPct((cryptoUsd / equityUsd) * 100) : null,
      holdingCount: slice.holdings.length,
      topN,
      topNWeightPct: topWeightPct,
      concentrationHhi: hhi,
    },
    topHoldings,
    note: MARKS_NOTE,
  };
}

/**
 * Compare holdings across two portfolios and/or check whether specific symbols are held.
 * Workspace only — no live prices.
 */
export function buildAgentPortfolioHoldingsCompare(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioA?: string | null;
  portfolioB?: string | null;
  symbols?: string[] | null;
}) {
  const sliceA = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioA);
  if (!sliceA) {
    return { ok: false as const, error: "Portfolio A not found.", openInApp: "/portfolio" as const };
  }

  const wantB = Boolean(args.portfolioB?.trim());
  const sliceB = wantB ? resolveAgentPortfolioSlice(args.workspace.state, args.portfolioB) : null;
  if (wantB && !sliceB) {
    return { ok: false as const, error: "Portfolio B not found.", openInApp: "/portfolio" as const };
  }

  const setA = new Set(sliceA.holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean));
  const setB = new Set(
    (sliceB?.holdings ?? []).map((h) => h.symbol.trim().toUpperCase()).filter(Boolean),
  );

  const symbols = (args.symbols ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);

  const symbolChecks =
    symbols.length > 0
      ? symbols.map((symbol) => ({
          symbol,
          inPortfolioA: setA.has(symbol),
          inPortfolioB: sliceB ? setB.has(symbol) : null,
        }))
      : null;

  let overlap: {
    shared: string[];
    onlyInA: string[];
    onlyInB: string[];
    sharedCount: number;
  } | null = null;

  if (sliceB) {
    const shared = [...setA].filter((s) => setB.has(s)).sort();
    const onlyInA = [...setA].filter((s) => !setB.has(s)).sort();
    const onlyInB = [...setB].filter((s) => !setA.has(s)).sort();
    overlap = {
      shared,
      onlyInA,
      onlyInB,
      sharedCount: shared.length,
    };
  }

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolioA: {
      id: sliceA.portfolio.id,
      name: sliceA.portfolio.name,
      holdingCount: setA.size,
      symbols: [...setA].sort(),
    },
    portfolioB: sliceB
      ? {
          id: sliceB.portfolio.id,
          name: sliceB.portfolio.name,
          holdingCount: setB.size,
          symbols: [...setB].sort(),
        }
      : null,
    overlap,
    symbolChecks,
    note: "Symbol lists from saved holdings only — no live prices or weights in this compare.",
  };
}

/**
 * Single holding by symbol from saved marks (shares, cost, worth, weight, unrealized).
 */
export function buildAgentPortfolioHolding(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  symbol: string;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }

  const sym = args.symbol.trim().toUpperCase();
  if (!sym) {
    return { ok: false as const, error: "Symbol required.", openInApp: "/portfolio" as const };
  }

  const cashUsd = normalizeUsdForDisplay(netCashUsd(slice.transactions));
  const equityUsd = normalizeUsdForDisplay(equityMarketValue(slice.holdings));
  const allocationDenom = equityUsd + Math.max(0, cashUsd);

  const holding =
    slice.holdings.find((h) => h.symbol.trim().toUpperCase() === sym) ??
    slice.holdings.find((h) => h.symbol.trim().toUpperCase().includes(sym)) ??
    null;

  if (!holding) {
    const candidates = slice.holdings
      .map((h) => h.symbol)
      .filter((s) => s.toUpperCase().includes(sym.slice(0, 3)))
      .slice(0, 8);
    return {
      ok: false as const,
      error: `No holding matching "${sym}" in ${slice.portfolio.name}.`,
      openInApp: "/portfolio" as const,
      portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
      suggestions: candidates,
    };
  }

  const serialized = serializeHolding(holding, allocationDenom);
  const tradeCount = slice.transactions.filter(
    (t) => t.kind === "trade" && t.symbol.trim().toUpperCase() === holding.symbol.trim().toUpperCase(),
  ).length;

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    holding: serialized,
    tradeCount,
    note: MARKS_NOTE,
  };
}

/**
 * Recent ledger activity digest — trades / cash / income / expenses counts + last N rows.
 * Pure filter on saved transactions (no market APIs).
 */
export function buildAgentPortfolioActivityDigest(args: {
  workspace: AgentPortfolioWorkspace;
  portfolioQuery?: string | null;
  limit?: number;
}) {
  const slice = resolveAgentPortfolioSlice(args.workspace.state, args.portfolioQuery);
  if (!slice) {
    return { ok: false as const, error: "Portfolio not found.", openInApp: "/portfolio" as const };
  }

  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
  const txs = slice.transactions;
  const byKind = {
    trade: txs.filter((t) => t.kind === "trade").length,
    cash: txs.filter((t) => t.kind === "cash").length,
    income: txs.filter((t) => t.kind === "income").length,
    expense: txs.filter((t) => t.kind === "expense").length,
  };

  const recent = txs.slice(0, limit).map((t) => ({
    date: t.date,
    kind: t.kind,
    operation: t.operation,
    symbol: t.symbol || null,
    shares: Number.isFinite(t.shares) && t.shares !== 0 ? t.shares : null,
    sumUsd: round2(t.sum),
    note: t.note?.trim() || null,
  }));

  const latestDate = txs[0]?.date ?? null;
  const oldestInWindow = recent[recent.length - 1]?.date ?? null;

  return {
    ok: true as const,
    openInApp: "/portfolio" as const,
    portfolio: { id: slice.portfolio.id, name: slice.portfolio.name },
    totals: {
      transactionCount: txs.length,
      ...byKind,
    },
    window: { latestDate, oldestInRecent: oldestInWindow, recentCount: recent.length },
    recent,
    note: "From saved transaction ledger only — not a brokerage live sync.",
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

  const catalog = portfolioCatalog(state);

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
