/**
 * Deterministic Manual + SnapTrade activity fixtures for parity certification.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  normalizeSnaptradeActivities,
  type SnapTradeNormalizeContext,
  type SnapTradeSyncDraftTransaction,
} from "@/lib/snaptrade/snaptrade-normalize-activity";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

export const CERT_CTX: SnapTradeNormalizeContext = {
  accountId: "acct-cert-1",
  authorizationId: "auth-cert-1",
  syncTimestamp: "2024-06-15T12:00:00.000Z",
};

export type ParityFixture = {
  id: string;
  name: string;
  /** Manual portfolio transactions (source MANUAL). */
  manual: PortfolioTransaction[];
  /** Raw SnapTrade activity rows representing the same economics. */
  activities: Record<string, unknown>[];
};

function manualTx(
  partial: Partial<PortfolioTransaction> &
    Pick<PortfolioTransaction, "id" | "operation" | "date" | "sum" | "kind">,
): PortfolioTransaction {
  return {
    portfolioId: "manual-cert",
    symbol: partial.symbol ?? "USD",
    name: partial.name ?? partial.symbol ?? "USD",
    logoUrl: null,
    shares: partial.shares ?? 0,
    price: partial.price ?? 0,
    fee: partial.fee ?? 0,
    profitPct: null,
    profitUsd: null,
    source: "MANUAL",
    ...partial,
  };
}

function sym(symbol: string, name?: string) {
  return { symbol, description: name ?? symbol };
}

function activity(
  id: string,
  type: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return { id, type, ...fields };
}

/** Stamp connected drafts into full transactions with stable local ids. */
export function draftsToConnected(
  drafts: readonly SnapTradeSyncDraftTransaction[],
  portfolioId = "connected-cert",
): PortfolioTransaction[] {
  const withIds: PortfolioTransaction[] = drafts.map((d, i) => ({
    ...d,
    id: `c-${String(i + 1).padStart(4, "0")}`,
    portfolioId,
  }));
  const { transactions } = migratePortfolioTransactionSequences(withIds);
  return transactions;
}

export function connectedFromActivities(
  activities: readonly Record<string, unknown>[],
  ctx: SnapTradeNormalizeContext = CERT_CTX,
): { transactions: PortfolioTransaction[]; warnings: ReturnType<typeof normalizeSnaptradeActivities>["warnings"] } {
  const { drafts, warnings } = normalizeSnaptradeActivities(activities, ctx);
  return { transactions: draftsToConnected(drafts), warnings };
}

export const PARITY_FIXTURES: ParityFixture[] = [
  {
    id: "01-cash-deposit",
    name: "Cash deposit",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        name: "US Dollar",
        shares: 10000,
        price: 1,
        sum: 10000,
        sequence: 1,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 10000,
        currency: { code: "USD" },
      }),
    ],
  },
  {
    id: "02-single-buy",
    name: "Single buy",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 10000,
        price: 1,
        sum: 10000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 150,
        sum: -1500,
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 10000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 150,
        amount: -1500,
        symbol: sym("AAPL", "Apple"),
        currency: { code: "USD" },
      }),
    ],
  },
  {
    id: "03-multiple-buys",
    name: "Multiple buys",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 20000,
        price: 1,
        sum: 20000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 150,
        sum: -1500,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "trade",
        operation: "Buy",
        date: "2024-02-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 5,
        price: 160,
        sum: -800,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 20000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 150,
        amount: -1500,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "BUY", {
        trade_date: "2024-02-10T00:00:00.000Z",
        units: 5,
        price: 160,
        amount: -800,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "04-partial-sell",
    name: "Partial sell",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 10000,
        price: 1,
        sum: 10000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 100,
        sum: -1000,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "trade",
        operation: "Sell",
        date: "2024-03-01",
        symbol: "AAPL",
        name: "Apple",
        shares: 4,
        price: 125,
        sum: 500,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 10000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 100,
        amount: -1000,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "SELL", {
        trade_date: "2024-03-01T00:00:00.000Z",
        units: 4,
        price: 125,
        amount: 500,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "05-full-sell",
    name: "Full sell",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 5000,
        price: 1,
        sum: 5000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 100,
        sum: -1000,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "trade",
        operation: "Sell",
        date: "2024-04-01",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 120,
        sum: 1200,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 100,
        amount: -1000,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "SELL", {
        trade_date: "2024-04-01T00:00:00.000Z",
        units: 10,
        price: 120,
        amount: 1200,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "06-dividend",
    name: "Dividend",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 5000,
        price: 1,
        sum: 5000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 100,
        sum: -1000,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "income",
        operation: "Dividend",
        date: "2024-05-01",
        symbol: "AAPL",
        name: "Apple",
        shares: 25,
        price: 1,
        sum: 25,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 100,
        amount: -1000,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "DIVIDEND", {
        trade_date: "2024-05-01T00:00:00.000Z",
        amount: 25,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "07-interest",
    name: "Interest",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 5000,
        price: 1,
        sum: 5000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "income",
        operation: "Other income",
        date: "2024-02-01",
        symbol: "USD",
        name: "US Dollar",
        shares: 12.5,
        price: 1,
        sum: 12.5,
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      }),
      activity("a2", "INTEREST", {
        trade_date: "2024-02-01T00:00:00.000Z",
        amount: 12.5,
        currency: { code: "USD" },
      }),
    ],
  },
  {
    id: "08-deposit-withdrawal",
    name: "Deposit + withdrawal",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 10000,
        price: 1,
        sum: 10000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "cash",
        operation: "Cash Out",
        date: "2024-02-15",
        symbol: "USD",
        shares: 2500,
        price: 1,
        sum: -2500,
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 10000,
        currency: { code: "USD" },
      }),
      activity("a2", "WITHDRAWAL", {
        trade_date: "2024-02-15T00:00:00.000Z",
        amount: 2500,
        currency: { code: "USD" },
      }),
    ],
  },
  {
    id: "09-fee",
    name: "Fee",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 1000,
        price: 1,
        sum: 1000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "expense",
        operation: "Other expense",
        date: "2024-01-20",
        symbol: "USD",
        name: "US Dollar",
        shares: 7,
        price: 1,
        sum: -7,
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 1000,
        currency: { code: "USD" },
      }),
      activity("a2", "FEE", {
        trade_date: "2024-01-20T00:00:00.000Z",
        amount: -7,
        currency: { code: "USD" },
      }),
    ],
  },
  {
    id: "10-stock-etf",
    name: "Stock + ETF",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 20000,
        price: 1,
        sum: 20000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 150,
        sum: -1500,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-11",
        symbol: "VTI",
        name: "Vanguard Total",
        shares: 20,
        price: 200,
        sum: -4000,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 20000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 150,
        amount: -1500,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "BUY", {
        trade_date: "2024-01-11T00:00:00.000Z",
        units: 20,
        price: 200,
        amount: -4000,
        symbol: sym("VTI", "Vanguard Total"),
      }),
    ],
  },
  {
    id: "11-fractional",
    name: "Fractional shares",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 1000,
        price: 1,
        sum: 1000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 0.12345678,
        price: 180.123456,
        sum: -(0.12345678 * 180.123456),
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 1000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 0.12345678,
        price: 180.123456,
        amount: -(0.12345678 * 180.123456),
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "12-same-day-buy-sell",
    name: "Same-day buy/sell",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-02",
        symbol: "USD",
        shares: 5000,
        price: 1,
        sum: 5000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-15",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 100,
        sum: -1000,
        sequence: 2,
      }),
      manualTx({
        id: "m3",
        kind: "trade",
        operation: "Sell",
        date: "2024-01-15",
        symbol: "AAPL",
        name: "Apple",
        shares: 10,
        price: 110,
        sum: 1100,
        sequence: 3,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-15T00:00:00.000Z",
        units: 10,
        price: 100,
        amount: -1000,
        symbol: sym("AAPL", "Apple"),
      }),
      activity("a3", "SELL", {
        trade_date: "2024-01-15T00:00:00.000Z",
        units: 10,
        price: 110,
        amount: 1100,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
  {
    id: "13-same-day-deposit-buy",
    name: "Same-day deposit/buy",
    manual: [
      manualTx({
        id: "m1",
        kind: "cash",
        operation: "Cash In",
        date: "2024-01-10",
        symbol: "USD",
        shares: 5000,
        price: 1,
        sum: 5000,
        sequence: 1,
      }),
      manualTx({
        id: "m2",
        kind: "trade",
        operation: "Buy",
        date: "2024-01-10",
        symbol: "AAPL",
        name: "Apple",
        shares: 5,
        price: 100,
        sum: -500,
        sequence: 2,
      }),
    ],
    activities: [
      activity("a1", "DEPOSIT", {
        trade_date: "2024-01-10T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      }),
      activity("a2", "BUY", {
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 5,
        price: 100,
        amount: -500,
        symbol: sym("AAPL", "Apple"),
      }),
    ],
  },
];

/** Core economic fixtures used by the parity matrix (1–13). */
export function economicParityCases(): Array<{
  id: string;
  name: string;
  manual: PortfolioTransaction[];
  connected: PortfolioTransaction[];
}> {
  return PARITY_FIXTURES.map((f) => {
    const { transactions } = connectedFromActivities(f.activities);
    const { transactions: manual } = migratePortfolioTransactionSequences(f.manual);
    return { id: f.id, name: f.name, manual, connected: transactions };
  });
}
