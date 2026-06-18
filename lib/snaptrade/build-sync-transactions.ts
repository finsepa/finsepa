import "server-only";

import { format, parseISO, subYears } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { replayTradeTransactionsToHoldings } from "@/lib/portfolio/rebuild-holdings-from-trades";
import type { Snaptrade } from "snaptrade-typescript-sdk";

import type { PortfolioSnaptradeSyncSettings } from "@/lib/snaptrade/sync-settings";
import { DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS } from "@/lib/snaptrade/sync-settings";

export type SnapTradeSyncDraftTransaction = Omit<PortfolioTransaction, "id" | "portfolioId">;

type SnapTradeCredentials = {
  snaptradeUserId: string;
  userSecret: string;
};

export type BrokerPositionSnapshot = {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
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

function ymdFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return null;
  }
}

function symbolFromUniversal(universal: unknown): { symbol: string; name: string } | null {
  const u = asRecord(universal);
  if (!u) return null;
  const raw =
    readString(u.symbol) ?? readString(u.raw_symbol) ?? readString(u.ticker);
  if (!raw) return null;
  const symbol = raw.toUpperCase().replace(/\.(US|NASDAQ|NYSE)$/i, "");
  const name = readString(u.description) ?? readString(u.name) ?? symbol;
  return { symbol, name };
}

export function symbolFromPosition(pos: Record<string, unknown>): { symbol: string; name: string } | null {
  const universal =
    asRecord(pos.universal_symbol) ??
    asRecord(pos.symbol) ??
    asRecord(pos.instrument);
  const fromUniversal = symbolFromUniversal(universal);
  if (fromUniversal) return fromUniversal;
  const raw = readString(pos.symbol);
  if (!raw) return null;
  const symbol = raw.toUpperCase();
  return { symbol, name: readString(pos.description) ?? symbol };
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

function txDedupeKey(t: SnapTradeSyncDraftTransaction): string {
  const shares = Math.round(t.shares * 10000) / 10000;
  const price = Math.round(t.price * 100) / 100;
  return `${t.date}|${t.operation}|${t.symbol}|${shares}|${price}`;
}

function mergeUniqueTransactions(
  base: SnapTradeSyncDraftTransaction[],
  extra: SnapTradeSyncDraftTransaction[],
): SnapTradeSyncDraftTransaction[] {
  const seen = new Set(base.map(txDedupeKey));
  const out = [...base];
  for (const t of extra) {
    const key = txDedupeKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function mapActivityToDraft(row: Record<string, unknown>): SnapTradeSyncDraftTransaction | null {
  const type = (readString(row.type) ?? "").toUpperCase();
  const sym =
    symbolFromUniversal(row.symbol) ??
    symbolFromUniversal(row.universal_symbol) ??
    symbolFromPosition(row);
  if (!sym) return null;

  const date = ymdFromIso(readString(row.trade_date) ?? readString(row.date));
  if (!date) return null;

  const units = Math.abs(readNumber(row.units) ?? readNumber(row.quantity) ?? 0);
  const price = readNumber(row.price) ?? 0;
  const amount = readNumber(row.amount);
  const fee = Math.abs(readNumber(row.fee) ?? 0);

  if (type.includes("DIVIDEND") || type === "INCOME") {
    const sum = amount ?? units * price;
    if (!Number.isFinite(sum) || sum === 0) return null;
    return {
      kind: "income",
      operation: "Dividend",
      symbol: sym.symbol,
      name: sym.name,
      logoUrl: null,
      date,
      shares: units || 0,
      price: price || Math.abs(sum),
      fee: 0,
      sum: Math.abs(sum),
      profitPct: null,
      profitUsd: null,
    };
  }

  if (type.includes("BUY") || type === "PURCHASE") {
    if (units <= 0 || price <= 0) return null;
    const sum = amount ?? -(units * price + fee);
    return {
      kind: "trade",
      operation: "Buy",
      symbol: sym.symbol,
      name: sym.name,
      logoUrl: null,
      date,
      shares: units,
      price,
      fee,
      sum: sum < 0 ? sum : -(units * price + fee),
      profitPct: null,
      profitUsd: null,
    };
  }

  if (type.includes("SELL") || type === "SALE") {
    if (units <= 0 || price <= 0) return null;
    const sum = amount ?? units * price - fee;
    return {
      kind: "trade",
      operation: "Sell",
      symbol: sym.symbol,
      name: sym.name,
      logoUrl: null,
      date,
      shares: units,
      price,
      fee,
      sum: sum > 0 ? sum : units * price - fee,
      profitPct: null,
      profitUsd: null,
    };
  }

  if (type.includes("CONTRIBUTION") || type.includes("DEPOSIT") || type.includes("CASH")) {
    const sum = amount ?? readNumber(row.units);
    if (sum == null || sum === 0) return null;
    const abs = Math.abs(sum);
    return {
      kind: "cash",
      operation: sum >= 0 ? "Cash In" : "Cash Out",
      symbol: "USD",
      name: "US Dollar",
      logoUrl: null,
      date,
      shares: abs,
      price: 1,
      fee: 0,
      sum,
      profitPct: null,
      profitUsd: null,
    };
  }

  return null;
}

function mapExecutedOrderToDraft(row: Record<string, unknown>): SnapTradeSyncDraftTransaction | null {
  const status = (readString(row.status) ?? "").toUpperCase();
  const filled = readNumber(row.filled_quantity) ?? 0;
  if (status !== "EXECUTED" && filled <= 0) return null;

  const sym = symbolFromUniversal(row.universal_symbol);
  if (!sym) return null;

  const shares = filled > 0 ? filled : readNumber(row.total_quantity) ?? 0;
  const price = readNumber(row.execution_price) ?? 0;
  if (shares <= 0 || price <= 0) return null;

  const date =
    ymdFromIso(readString(row.time_executed) ?? readString(row.time_placed)) ?? format(new Date(), "yyyy-MM-dd");
  const action = (readString(row.action) ?? "BUY").toUpperCase();
  const isBuy = action.includes("BUY");

  return {
    kind: "trade",
    operation: isBuy ? "Buy" : "Sell",
    symbol: sym.symbol,
    name: sym.name,
    logoUrl: readString(asRecord(row.universal_symbol)?.logo_url),
    date,
    shares,
    price,
    fee: 0,
    sum: isBuy ? -(shares * price) : shares * price,
    profitPct: null,
    profitUsd: null,
  };
}

async function fetchAllActivities(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountId: string,
  startDateYmd: string,
): Promise<SnapTradeSyncDraftTransaction[]> {
  const startDate = startDateYmd;
  const endDate = format(new Date(), "yyyy-MM-dd");
  const out: SnapTradeSyncDraftTransaction[] = [];
  const limit = 1000;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await snaptrade.accountInformation.getAccountActivities({
      accountId,
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
      const mapped = mapActivityToDraft(rec);
      if (mapped) out.push(mapped);
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
  accountId: string,
): Promise<SnapTradeSyncDraftTransaction[]> {
  const res = await snaptrade.accountInformation.getUserAccountOrders({
    accountId,
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    state: "all",
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  const out: SnapTradeSyncDraftTransaction[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const mapped = mapExecutedOrderToDraft(rec);
    if (mapped) out.push(mapped);
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
    out.push({ symbol: sym.symbol, name: sym.name, shares, avgPrice });
  }
  return out;
}

async function fetchBrokerCash(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountId: string,
): Promise<number> {
  const balanceRes = await snaptrade.accountInformation.getUserAccountBalance({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    accountId,
  });
  const balanceRows = Array.isArray(balanceRes.data) ? balanceRes.data : [];
  let totalCash = 0;
  for (const row of balanceRows) {
    const cash = readNumber((row as { cash?: unknown }).cash);
    if (cash != null && cash > 0) totalCash += cash;
  }
  return totalCash;
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

function reconcileHoldings(
  txs: SnapTradeSyncDraftTransaction[],
  brokerPositions: BrokerPositionSnapshot[],
  syncDate: string,
): SnapTradeSyncDraftTransaction[] {
  const ledgerShares = replaySharesBySymbol(txs);
  const out = [...txs];

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
    });
  }

  return out;
}

function reconcileCash(
  txs: SnapTradeSyncDraftTransaction[],
  brokerCash: number,
  syncDate: string,
): SnapTradeSyncDraftTransaction[] {
  const ledger = ledgerCashUsd(txs);
  const diff = brokerCash - ledger;
  if (Math.abs(diff) < 0.01) return txs;

  const abs = Math.abs(diff);
  return [
    ...txs,
    {
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
      note: cashAdjustmentNote(brokerCash, ledger),
    },
  ];
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
): SnapTradeSyncDraftTransaction[] {
  return brokerPositions.map((pos) => ({
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
  }));
}

/** Snowball-style sync: activities + recent orders, then reconcile to broker holdings/cash. */
export async function buildSnapTradeSyncTransactions(
  snaptrade: Snaptrade,
  credentials: SnapTradeCredentials,
  accountIds: string[],
  syncDate: string,
  syncSettings: PortfolioSnaptradeSyncSettings = DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
  updateFromYmd: string | null = null,
): Promise<SnapTradeSyncDraftTransaction[]> {
  const activitiesStartDate =
    updateFromYmd ?? format(subYears(new Date(), 5), "yyyy-MM-dd");
  let transactions: SnapTradeSyncDraftTransaction[] = [];
  const brokerPositions: BrokerPositionSnapshot[] = [];
  let brokerCash = 0;

  for (const accountId of accountIds) {
    const [activities, orders, positions, cash] = await Promise.all([
      fetchAllActivities(snaptrade, credentials, accountId, activitiesStartDate),
      fetchExecutedOrders(snaptrade, credentials, accountId),
      fetchBrokerPositions(snaptrade, credentials, accountId),
      fetchBrokerCash(snaptrade, credentials, accountId),
    ]);

    transactions = mergeUniqueTransactions(transactions, activities);
    transactions = mergeUniqueTransactions(transactions, orders);
    brokerPositions.push(...positions);
    brokerCash += cash;
  }

  if (syncSettings.emulateTransactionHistory && !hasImportedTrades(transactions)) {
    transactions = mergeUniqueTransactions(
      transactions,
      emulateHoldingsAsTrades(brokerPositions, syncDate),
    );
  }

  if (syncSettings.adjustPositionsToBrokerage) {
    transactions = reconcileHoldings(transactions, brokerPositions, syncDate);
    transactions = reconcileCash(transactions, brokerCash, syncDate);
  }

  return sortTransactions(transactions);
}
