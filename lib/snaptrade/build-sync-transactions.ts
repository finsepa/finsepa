import "server-only";

import { format, subYears } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { replayTradeTransactionsToHoldings } from "@/lib/portfolio/rebuild-holdings-from-trades";
import type { Snaptrade } from "snaptrade-typescript-sdk";

import type { PortfolioSnaptradeSyncSettings } from "@/lib/snaptrade/sync-settings";
import { DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS } from "@/lib/snaptrade/sync-settings";
import { snaptradeAdjustmentExternalId } from "@/lib/snaptrade/snaptrade-external-id";
import { cashBridgeNote, openingCashBridgeDate } from "@/lib/snaptrade/snaptrade-cash-bridge";
import { dedupeSnaptradeOrdersAgainstActivities } from "@/lib/snaptrade/snaptrade-order-activity-dedupe";
import {
  normalizeSnaptradeActivity,
  normalizeSnaptradeOrder,
  symbolFromPosition,
  type SnapTradeSyncDraftTransaction,
} from "@/lib/snaptrade/snaptrade-normalize-activity";

export type { SnapTradeSyncDraftTransaction };
export { symbolFromPosition };
export { cashBridgeNote, openingCashBridgeDate } from "@/lib/snaptrade/snaptrade-cash-bridge";

type SnapTradeCredentials = {
  snaptradeUserId: string;
  userSecret: string;
};

export type BrokerPositionSnapshot = {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  /** Broker last/mark price when available (for quote fallback). */
  marketPrice: number;
};

// ── Structured sync diagnostics (Phase 5B) ──────────────────────────────────

export type SnapTradeSyncWarningCode =
  | "UNKNOWN_ACTIVITY"
  | "UNMAPPED_ORDER"
  | "MULTI_CURRENCY_UNSUPPORTED"
  | "POSITION_MISMATCH"
  | "POSITION_BRIDGE"
  | "CASH_MISMATCH"
  | "CASH_BRIDGE"
  | "ORDER_ACTIVITY_DEDUPED"
  | "INCREMENTAL_NO_RECONCILE"
  | "HISTORY_INCOMPLETE";

export type SnapTradeSyncWarning = {
  code: SnapTradeSyncWarningCode;
  message: string;
  accountId?: string;
  activityType?: string;
  symbol?: string;
  detail?: Record<string, unknown>;
};

export type SnapTradeReconcilePosition = {
  symbol: string;
  brokerShares: number;
  ledgerShares: number;
  diff: number;
  status: "MATCHED" | "POSITION_MISMATCH";
};

export type SnapTradeReconciliation = {
  /** REPORT_ONLY = default (never fabricates rows). ADJUSTED = synthetic rows appended. */
  mode: "REPORT_ONLY" | "ADJUSTED";
  multiCurrency: boolean;
  currencies: string[];
  positions: SnapTradeReconcilePosition[];
  cash: {
    brokerCash: number;
    ledgerCash: number;
    diff: number;
    status: "MATCHED" | "CASH_MISMATCH";
  } | null;
};

export type SnapTradeSyncBuildResult = {
  transactions: SnapTradeSyncDraftTransaction[];
  warnings: SnapTradeSyncWarning[];
  reconciliation: SnapTradeReconciliation;
  /** Symbol → broker mark USD (canonicalized symbols). */
  brokerMarks: Record<string, number>;
};

type BuildContext = {
  accountId: string;
  authorizationId: string;
  syncTimestamp: string;
};

function asRecord(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function readNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim()) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function readCurrencyCode(x: unknown): string | null {
  const rec = asRecord(x);
  if (rec) {
    return readString(rec.code) ?? readString(rec.currency) ?? null;
  }
  return readString(x);
}

export function sharesFromPosition(pos: Record<string, unknown>): number {
  return (
    readNumber(pos.fractional_units) ??
    readNumber(pos.units) ??
    readNumber(pos.quantity) ??
    0
  );
}

export function priceFromPosition(pos: Record<string, unknown>): number {
  const fromAvg =
    readNumber(pos.average_purchase_price) ?? readNumber(pos.averagePurchasePrice);
  if (fromAvg != null && fromAvg > 0) return fromAvg;

  const perUnit = readNumber(pos.price) ?? readNumber(pos.current_price);
  if (perUnit != null && perUnit > 0) return perUnit;

  const shares = sharesFromPosition(pos);
  const costBasis = readNumber(pos.cost_basis) ?? readNumber(pos.costBasis);
  if (costBasis != null && shares > 0) return costBasis / shares;

  return 0;
}

/** Last/mark unit price from the broker position (not cost basis). */
export function marketPriceFromPosition(pos: Record<string, unknown>): number {
  const perUnit = readNumber(pos.price) ?? readNumber(pos.current_price);
  if (perUnit != null && perUnit > 0) return perUnit;
  return 0;
}

export function positionsFromResponse(data: unknown): Record<string, unknown>[] {
  const root = asRecord(data);
  if (!root) return [];
  const results = root.results ?? root.positions ?? root.equity_positions;
  if (!Array.isArray(results)) return [];
  return results.map(asRecord).filter((x): x is Record<string, unknown> => x != null);
}

function formatSharesLabel(n: number): string {
  const rounded = Math.round(n * 100000) / 100000;
  return String(rounded);
}

export function holdingAdjustmentNote(brokerShares: number, ledgerShares: number): string {
  return `Automatically generated transaction to adjust balance, since the balance reported by broker (${formatSharesLabel(brokerShares)} shares) does not match the imported transaction balance (${formatSharesLabel(ledgerShares)} shares), due to sync limitations.`;
}

export function cashAdjustmentNote(brokerCash: number, ledgerCash: number): string {
  return `Automatically generated transaction to adjust cash balance, since cash reported by broker ($${brokerCash.toFixed(2)}) does not match the imported ledger balance ($${ledgerCash.toFixed(2)}), due to sync limitations.`;
}

type MapResult = { draft: SnapTradeSyncDraftTransaction | null; warning: SnapTradeSyncWarning | null };

function mapActivityToDraft(row: Record<string, unknown>, ctx: BuildContext): MapResult {
  const r = normalizeSnaptradeActivity(row, ctx);
  return { draft: r.draft, warning: r.warning };
}

function mapExecutedOrderToDraft(row: Record<string, unknown>, ctx: BuildContext): MapResult {
  const r = normalizeSnaptradeOrder(row, ctx);
  return { draft: r.draft, warning: r.warning };
}

async function fetchAllActivities(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  ctx: BuildContext,
  startDateYmd: string,
  warnings: SnapTradeSyncWarning[],
): Promise<SnapTradeSyncDraftTransaction[]> {
  const startDate = startDateYmd;
  const endDate = format(new Date(), "yyyy-MM-dd");
  const out: SnapTradeSyncDraftTransaction[] = [];
  const limit = 1000;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await snaptrade.accountInformation.getAccountActivities({
      accountId: ctx.accountId,
      userId: credentials.snaptradeUserId,
      userSecret: credentials.userSecret,
      startDate,
      endDate,
      offset,
      limit,
    });
    const body = asRecord(res.data);
    const rows = Array.isArray(body?.data) ? body.data : [];
    const pagination = asRecord(body?.pagination);
    total = readNumber(pagination?.total) ?? rows.length;

    for (const row of rows) {
      const rec = asRecord(row);
      if (!rec) continue;
      const { draft, warning } = mapActivityToDraft(rec, ctx);
      if (draft) out.push(draft);
      if (warning) warnings.push(warning);
    }

    if (rows.length === 0) break;
    offset += rows.length;
    if (rows.length < limit) break;
  }

  return out;
}

async function fetchExecutedOrders(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  ctx: BuildContext,
  warnings: SnapTradeSyncWarning[],
): Promise<SnapTradeSyncDraftTransaction[]> {
  const res = await snaptrade.accountInformation.getUserAccountOrders({
    accountId: ctx.accountId,
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    state: "all",
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  const out: SnapTradeSyncDraftTransaction[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const { draft, warning } = mapExecutedOrderToDraft(rec, ctx);
    if (draft) out.push(draft);
    if (warning) warnings.push(warning);
  }
  return out;
}

async function fetchBrokerPositions(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountId: string,
): Promise<BrokerPositionSnapshot[]> {
  const positionsRes = await snaptrade.accountInformation.getAllAccountPositions({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    accountId,
  });

  const out: BrokerPositionSnapshot[] = [];
  for (const pos of positionsFromResponse(positionsRes.data)) {
    const sym = symbolFromPosition(pos);
    const shares = sharesFromPosition(pos);
    const avgPrice = priceFromPosition(pos);
    if (!sym || shares <= 0 || avgPrice <= 0) continue;
    const marketPrice = marketPriceFromPosition(pos);
    out.push({
      symbol: sym.symbol,
      name: sym.name,
      shares,
      avgPrice,
      marketPrice: marketPrice > 0 ? marketPrice : avgPrice,
    });
  }
  return out;
}

type BrokerCashResult = { cashUsd: number; currencies: string[]; hasNonUsd: boolean };

async function fetchBrokerCash(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountId: string,
): Promise<BrokerCashResult> {
  const balanceRes = await snaptrade.accountInformation.getUserAccountBalance({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    accountId,
  });
  const balanceRows = Array.isArray(balanceRes.data) ? balanceRes.data : [];
  let totalCash = 0;
  const currencies = new Set<string>();
  let hasNonUsd = false;
  for (const row of balanceRows) {
    const rec = asRecord(row);
    const cash =
      readNumber(rec?.cash) ??
      readNumber(rec?.cash_balance) ??
      readNumber(rec?.cashBalance) ??
      readNumber(asRecord(rec?.cash)?.amount);
    const code = (readCurrencyCode(rec?.currency) ?? "USD").toUpperCase();
    currencies.add(code);
    if (code !== "USD") {
      hasNonUsd = true;
      continue; // never sum non-USD into a USD figure
    }
    // Include zero; never use buying_power (margin) as cash.
    if (cash != null && Number.isFinite(cash) && cash >= 0) totalCash += cash;
  }
  return { cashUsd: totalCash, currencies: [...currencies], hasNonUsd };
}

function replaySharesBySymbol(txs: SnapTradeSyncDraftTransaction[]): Map<string, number> {
  const fake: PortfolioTransaction[] = txs.map((t, i) => ({
    ...t,
    id: `snaptrade-replay-${i}`,
    portfolioId: "snaptrade-replay",
  }));
  const holdings = replayTradeTransactionsToHoldings(fake);
  return new Map(holdings.map((h) => [h.symbol.toUpperCase(), h.shares]));
}

function ledgerCashUsd(txs: SnapTradeSyncDraftTransaction[]): number {
  return txs.reduce((s, t) => s + t.sum, 0);
}

/** Build the REPORT-ONLY reconciliation view (no fabricated rows). */
function buildReconciliationReport(
  txs: SnapTradeSyncDraftTransaction[],
  brokerPositions: BrokerPositionSnapshot[],
  cash: BrokerCashResult,
  mode: "REPORT_ONLY" | "ADJUSTED",
): { reconciliation: SnapTradeReconciliation; warnings: SnapTradeSyncWarning[] } {
  const warnings: SnapTradeSyncWarning[] = [];
  const ledgerShares = replaySharesBySymbol(txs);

  const positions: SnapTradeReconcilePosition[] = brokerPositions.map((pos) => {
    const sym = pos.symbol.toUpperCase();
    const ledger = ledgerShares.get(sym) ?? 0;
    const diff = pos.shares - ledger;
    const minDiff = Math.max(1e-6, pos.shares * 0.001);
    const status: SnapTradeReconcilePosition["status"] =
      Math.abs(diff) < minDiff ? "MATCHED" : "POSITION_MISMATCH";
    if (status === "POSITION_MISMATCH") {
      warnings.push({
        code: "POSITION_MISMATCH",
        message: `${sym}: broker reports ${formatSharesLabel(pos.shares)} shares but imported history replays to ${formatSharesLabel(ledger)}.`,
        symbol: sym,
        detail: { brokerShares: pos.shares, ledgerShares: ledger, diff },
      });
    }
    return { symbol: sym, brokerShares: pos.shares, ledgerShares: ledger, diff, status };
  });

  let cashReport: SnapTradeReconciliation["cash"] = null;
  if (cash.hasNonUsd) {
    warnings.push({
      code: "MULTI_CURRENCY_UNSUPPORTED",
      message: `Multi-currency balances detected (${cash.currencies.join(", ")}). Cash is not summed as USD; cash reconciliation is skipped.`,
      detail: { currencies: cash.currencies },
    });
  } else {
    const ledgerCash = ledgerCashUsd(txs);
    const diff = cash.cashUsd - ledgerCash;
    const status: "MATCHED" | "CASH_MISMATCH" = Math.abs(diff) < 0.01 ? "MATCHED" : "CASH_MISMATCH";
    if (status === "CASH_MISMATCH") {
      warnings.push({
        code: "CASH_MISMATCH",
        message: `Broker cash ($${cash.cashUsd.toFixed(2)}) does not match imported ledger cash ($${ledgerCash.toFixed(2)}).`,
        detail: { brokerCash: cash.cashUsd, ledgerCash, diff },
      });
    }
    cashReport = { brokerCash: cash.cashUsd, ledgerCash, diff, status };
  }

  // History incomplete: broker holds positions but no trades were imported.
  const hasPositions = brokerPositions.length > 0;
  if (hasPositions && !txs.some((t) => t.kind === "trade")) {
    warnings.push({
      code: "HISTORY_INCOMPLETE",
      message:
        "Broker reports open positions but no trade history was returned by the API. Holdings may be incomplete.",
      detail: { brokerPositions: brokerPositions.length },
    });
  }

  return {
    reconciliation: {
      mode,
      multiCurrency: cash.hasNonUsd,
      currencies: cash.currencies,
      positions,
      cash: cashReport,
    },
    warnings,
  };
}

/** Synthetic reconciliation rows (only when adjustPositionsToBrokerage is explicitly enabled). */
function reconcileHoldingsAdjustments(
  txs: SnapTradeSyncDraftTransaction[],
  brokerPositions: BrokerPositionSnapshot[],
  syncDate: string,
  ctx: BuildContext,
): SnapTradeSyncDraftTransaction[] {
  const ledgerShares = replaySharesBySymbol(txs);
  const out: SnapTradeSyncDraftTransaction[] = [];
  for (const pos of brokerPositions) {
    const sym = pos.symbol.toUpperCase();
    const ledger = ledgerShares.get(sym) ?? 0;
    const diff = pos.shares - ledger;
    const minDiff = Math.max(1e-6, pos.shares * 0.001);
    if (Math.abs(diff) < minDiff) continue;

    const shares = Math.abs(diff);
    const isBuy = diff > 0;
    out.push({
      kind: "trade",
      operation: isBuy ? "Buy" : "Sell",
      symbol: sym,
      name: pos.name,
      logoUrl: null,
      date: syncDate,
      shares,
      price: pos.avgPrice,
      fee: 0,
      sum: isBuy ? -(shares * pos.avgPrice) : shares * pos.avgPrice,
      profitPct: null,
      profitUsd: null,
      note: holdingAdjustmentNote(pos.shares, ledger),
      source: "SNAPTRADE_ADJUSTMENT",
      provider: "SNAPTRADE",
      externalId: snaptradeAdjustmentExternalId(ctx.accountId, "holding", sym),
      externalAccountId: ctx.accountId,
      externalAuthorizationId: ctx.authorizationId,
      externalActivityType: "RECONCILE_HOLDING",
      importedAt: ctx.syncTimestamp,
      lastSyncedAt: ctx.syncTimestamp,
      currency: "USD",
    });
  }
  return out;
}

function reconcileCashAdjustment(
  txs: SnapTradeSyncDraftTransaction[],
  brokerCash: number,
  syncDate: string,
  ctx: BuildContext,
  noteFn: (broker: number, ledger: number) => string = cashAdjustmentNote,
): SnapTradeSyncDraftTransaction | null {
  const ledger = ledgerCashUsd(txs);
  const diff = brokerCash - ledger;
  if (Math.abs(diff) < 0.01) return null;
  const abs = Math.abs(diff);
  return {
    kind: "cash",
    operation: diff > 0 ? "Cash In" : "Cash Out",
    symbol: "USD",
    name: "US Dollar",
    logoUrl: null,
    date: syncDate,
    shares: abs,
    price: 1,
    fee: 0,
    sum: diff,
    profitPct: null,
    profitUsd: null,
    note: noteFn(brokerCash, ledger),
    source: "SNAPTRADE_ADJUSTMENT",
    provider: "SNAPTRADE",
    externalId: snaptradeAdjustmentExternalId(ctx.accountId, "cash", "USD"),
    externalAccountId: ctx.accountId,
    externalAuthorizationId: ctx.authorizationId,
    externalActivityType: "RECONCILE_CASH",
    importedAt: ctx.syncTimestamp,
    lastSyncedAt: ctx.syncTimestamp,
    currency: "USD",
  };
}

function sortTransactions(txs: SnapTradeSyncDraftTransaction[]): SnapTradeSyncDraftTransaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const kindOrder = (k: SnapTradeSyncDraftTransaction["kind"]) =>
      k === "cash" ? 0 : k === "trade" ? 1 : 2;
    return kindOrder(a.kind) - kindOrder(b.kind);
  });
}

function hasImportedTrades(txs: SnapTradeSyncDraftTransaction[]): boolean {
  return txs.some((t) => t.kind === "trade");
}

function emulateHoldingsAsTrades(
  brokerPositions: BrokerPositionSnapshot[],
  syncDate: string,
  ctx: BuildContext,
): SnapTradeSyncDraftTransaction[] {
  return brokerPositions.map((pos) => {
    const sym = pos.symbol.toUpperCase();
    return {
      kind: "trade" as const,
      operation: "Buy",
      symbol: pos.symbol,
      name: pos.name,
      logoUrl: null,
      date: syncDate,
      shares: pos.shares,
      price: pos.avgPrice,
      fee: 0,
      sum: -(pos.shares * pos.avgPrice),
      profitPct: null,
      profitUsd: null,
      note: "Emulated from broker holdings because no transaction history was returned by the API.",
      source: "SNAPTRADE_ADJUSTMENT" as const,
      provider: "SNAPTRADE" as const,
      externalId: snaptradeAdjustmentExternalId(ctx.accountId, "emulated", sym),
      externalAccountId: ctx.accountId,
      externalAuthorizationId: ctx.authorizationId,
      externalActivityType: "EMULATED_HOLDING",
      importedAt: ctx.syncTimestamp,
      lastSyncedAt: ctx.syncTimestamp,
      currency: "USD",
    };
  });
}

/**
 * Snowball-style sync: activities + recent orders, then (report-only by default) reconcile
 * to broker holdings/cash. Every mapped row carries SnapTrade provenance + a stable externalId.
 */
export async function buildSnapTradeSyncTransactions(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountIds: string[],
  syncDate: string,
  authorizationId: string,
  syncSettings: PortfolioSnaptradeSyncSettings = DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
  updateFromYmd: string | null = null,
): Promise<SnapTradeSyncBuildResult> {
  const activitiesStartDate =
    updateFromYmd ?? format(subYears(new Date(), 5), "yyyy-MM-dd");
  const syncTimestamp = new Date().toISOString();
  const warnings: SnapTradeSyncWarning[] = [];
  const transactions: SnapTradeSyncDraftTransaction[] = [];
  const brokerPositions: BrokerPositionSnapshot[] = [];
  let brokerCash = 0;
  const currencySet = new Set<string>();
  let hasNonUsd = false;

  // Stable synthetic account id for cross-account adjustment rows.
  const adjustmentAccountKey = [...accountIds].sort().join("+") || "all";

  for (const accountId of accountIds) {
    const ctx: BuildContext = { accountId, authorizationId, syncTimestamp };
    const [activities, orders, positions, cash] = await Promise.all([
      fetchAllActivities(snaptrade, credentials, ctx, activitiesStartDate, warnings),
      fetchExecutedOrders(snaptrade, credentials, ctx, warnings),
      fetchBrokerPositions(snaptrade, credentials, accountId),
      fetchBrokerCash(snaptrade, credentials, accountId),
    ]);

    const { kept: ordersDeduped, dropped: ordersDropped } = dedupeSnaptradeOrdersAgainstActivities(
      activities,
      orders,
    );
    if (ordersDropped > 0) {
      warnings.push({
        code: "ORDER_ACTIVITY_DEDUPED",
        message: `Skipped ${ordersDropped} executed order(s) already covered by activity fills.`,
        accountId,
        detail: { dropped: ordersDropped },
      });
    }

    transactions.push(...activities);
    transactions.push(...ordersDeduped);
    brokerPositions.push(...positions);
    brokerCash += cash.cashUsd;
    for (const c of cash.currencies) currencySet.add(c);
    if (cash.hasNonUsd) hasNonUsd = true;
  }

  const adjustmentCtx: BuildContext = {
    accountId: adjustmentAccountKey,
    authorizationId,
    syncTimestamp,
  };

  const cashResult: BrokerCashResult = {
    cashUsd: brokerCash,
    currencies: [...currencySet],
    hasNonUsd,
  };

  const adjustEnabled = syncSettings.adjustPositionsToBrokerage === true;

  if (syncSettings.emulateTransactionHistory && !hasImportedTrades(transactions)) {
    transactions.push(...emulateHoldingsAsTrades(brokerPositions, syncDate, adjustmentCtx));
  }

  if (adjustEnabled) {
    const holdingAdj = reconcileHoldingsAdjustments(transactions, brokerPositions, syncDate, adjustmentCtx);
    transactions.push(...holdingAdj);
    if (!hasNonUsd) {
      const cashAdj = reconcileCashAdjustment(transactions, brokerCash, syncDate, adjustmentCtx);
      if (cashAdj) transactions.push(cashAdj);
    }
  } else if (updateFromYmd == null) {
    // Soft bridges only on FULL history sync. Incremental windows fetch partial trades;
    // reconciling those against full broker positions would invent duplicate buys/cash and
    // inflate NAV when merged on top of preserved older rows.
    const holdingAdj = reconcileHoldingsAdjustments(
      transactions,
      brokerPositions,
      syncDate,
      adjustmentCtx,
    );
    if (holdingAdj.length > 0) {
      transactions.push(...holdingAdj);
      warnings.push({
        code: "POSITION_BRIDGE",
        message: `Adjusted ${holdingAdj.length} position(s) so share counts match the brokerage.`,
        accountId: adjustmentAccountKey,
        detail: {
          symbols: holdingAdj.map((t) => t.symbol),
        },
      });
    }

    if (!hasNonUsd) {
      const ledgerBefore = ledgerCashUsd(transactions);
      const bridgeDate =
        transactions.some((t) => t.kind === "cash") ?
          syncDate
        : openingCashBridgeDate(transactions, syncDate);
      const cashAdj = reconcileCashAdjustment(
        transactions,
        brokerCash,
        bridgeDate,
        adjustmentCtx,
        cashBridgeNote,
      );
      if (cashAdj) {
        transactions.push(cashAdj);
        warnings.push({
          code: "CASH_BRIDGE",
          message: `Cash ledger adjusted to brokerage balance ($${brokerCash.toFixed(2)}; was $${ledgerBefore.toFixed(2)}).`,
          accountId: adjustmentAccountKey,
          detail: {
            brokerCash,
            ledgerBefore,
            bridgeDate,
            sum: cashAdj.sum,
          },
        });
      }
    }
  } else {
    warnings.push({
      code: "INCREMENTAL_NO_RECONCILE",
      message:
        "Incremental sync does not re-reconcile cash/positions. Use “first transaction” once if balances look doubled or stale.",
      accountId: adjustmentAccountKey,
      detail: { updateFromYmd },
    });
  }

  const { reconciliation, warnings: reconWarnings } = buildReconciliationReport(
    transactions,
    brokerPositions,
    cashResult,
    adjustEnabled ||
      transactions.some((t) => t.source === "SNAPTRADE_ADJUSTMENT") ?
      "ADJUSTED"
    : "REPORT_ONLY",
  );
  warnings.push(...reconWarnings);


  const brokerMarks: Record<string, number> = {};
  for (const p of brokerPositions) {
    if (p.marketPrice > 0) brokerMarks[p.symbol.toUpperCase()] = p.marketPrice;
  }

  return {
    transactions: sortTransactions(transactions),
    warnings,
    reconciliation,
    brokerMarks,
  };
}
