/**
 * Pure SnapTrade → canonical PortfolioTransaction draft normalizer.
 *
 * No SDK, no network, no `server-only`. Used by the sync builder and by
 * Manual↔Connected parity certification fixtures.
 */

import { format, parseISO } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  snaptradeActivityExternalId,
  snaptradeFallbackExternalId,
  snaptradeOrderExternalId,
} from "@/lib/snaptrade/snaptrade-external-id";
import { canonicalizeSnaptradeSymbol, isSnaptradeCryptoTypeHint } from "@/lib/snaptrade/snaptrade-crypto-symbol";
import { isSnaptradeOrderFillEligible } from "@/lib/snaptrade/snaptrade-order-fill-gate";

export type SnapTradeSyncDraftTransaction = Omit<PortfolioTransaction, "id" | "portfolioId">;

export type SnapTradeNormalizeContext = {
  accountId: string;
  authorizationId: string;
  syncTimestamp: string;
};

export type SnapTradeNormalizeWarningCode =
  | "UNKNOWN_ACTIVITY"
  | "UNMAPPED_ORDER"
  | "MULTI_CURRENCY_UNSUPPORTED"
  | "POSITION_MISMATCH"
  | "CASH_MISMATCH"
  | "HISTORY_INCOMPLETE";

export type SnapTradeNormalizeWarning = {
  code: SnapTradeNormalizeWarningCode;
  message: string;
  accountId?: string;
  activityType?: string;
  symbol?: string;
  detail?: Record<string, unknown>;
};

export type SnapTradeNormalizeResult = {
  draft: SnapTradeSyncDraftTransaction | null;
  warning: SnapTradeNormalizeWarning | null;
};

/**
 * Classify a SnapTrade activity `type` as external cash movement.
 * Brokers (esp. Alpaca) often label funding as ACH / WIRE / JOURNAL / FUNDING
 * rather than CONTRIBUTION / DEPOSIT — those must still become `kind: "cash"`.
 *
 * Returns:
 * - `"in"` / `"out"` — force sign (ignore raw amount sign)
 * - `"signed"` — trust provider amount sign (CASH / cash TRANSFER)
 * - `null` — not a cash activity
 */
export function classifySnaptradeCashActivityType(
  typeRaw: string,
  hasSymbol: boolean,
): "in" | "out" | "signed" | null {
  const type = typeRaw.toUpperCase();
  if (!type) return null;

  const isWithdrawal =
    type.includes("WITHDRAWAL") ||
    type.includes("WITHDRAW") ||
    type.includes("DISBURSEMENT") ||
    type === "CSW" ||
    (type.includes("ACH") && (type.includes("OUT") || type.includes("DEBIT"))) ||
    (type.includes("WIRE") && (type.includes("OUT") || type.includes("DEBIT"))) ||
    (type.includes("JOURNAL") && (type.includes("OUT") || type.includes("DEBIT")));

  if (isWithdrawal) return "out";

  const isDeposit =
    type.includes("CONTRIBUTION") ||
    type.includes("DEPOSIT") ||
    type.includes("FUNDING") ||
    type === "CONT" ||
    type === "CSD" ||
    type === "JNLC" ||
    (type.includes("ACH") && !type.includes("OUT") && !type.includes("DEBIT")) ||
    (type.includes("WIRE") && !type.includes("OUT") && !type.includes("DEBIT")) ||
    (type.includes("JOURNAL") && (type.includes("IN") || type.includes("CREDIT")));

  if (isDeposit) return "in";

  const isTransfer = type.includes("TRANSFER");
  if (
    type.includes("CASH") ||
    type === "JOURNAL" ||
    (isTransfer && !hasSymbol)
  ) {
    return "signed";
  }

  return null;
}

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
  const raw = readString(u.symbol) ?? readString(u.raw_symbol) ?? readString(u.ticker);
  if (!raw) return null;
  const typeHint = u.type ?? u.asset_type ?? u.assetType;
  const nameHint = readString(u.description) ?? readString(u.name);
  return canonicalizeSnaptradeSymbol(raw, { typeHint, nameHint });
}

export function symbolFromPosition(pos: Record<string, unknown>): { symbol: string; name: string } | null {
  const universal =
    asRecord(pos.universal_symbol) ?? asRecord(pos.symbol) ?? asRecord(pos.instrument);
  const fromUniversal = symbolFromUniversal(universal);
  if (fromUniversal) return fromUniversal;

  const raw = readString(pos.symbol) ?? readString(asRecord(pos.instrument)?.symbol);
  if (!raw) return null;
  const typeHint =
    asRecord(pos.instrument)?.type ??
    asRecord(pos.universal_symbol)?.type ??
    pos.asset_type ??
    pos.assetType;
  const nameHint = readString(pos.description) ?? readString(asRecord(pos.instrument)?.description);
  // Alpaca-style concatenated pairs (BTCUSD) without a typed universal symbol.
  const forceCrypto = isSnaptradeCryptoTypeHint(typeHint) || /^(?:[A-Z0-9]+)(?:USD|USDT)$/i.test(raw);
  return canonicalizeSnaptradeSymbol(raw, { typeHint, nameHint, forceCrypto });
}

function withProvenance(
  draft: SnapTradeSyncDraftTransaction,
  ctx: SnapTradeNormalizeContext,
  externalId: string,
  activityType: string,
  currency: string | null,
): SnapTradeSyncDraftTransaction {
  return {
    ...draft,
    source: "SNAPTRADE",
    provider: "SNAPTRADE",
    externalId,
    externalAccountId: ctx.accountId,
    externalAuthorizationId: ctx.authorizationId,
    externalActivityType: activityType,
    importedAt: ctx.syncTimestamp,
    lastSyncedAt: ctx.syncTimestamp,
    currency: currency ?? "USD",
  };
}

function activityExternalId(
  ctx: SnapTradeNormalizeContext,
  row: Record<string, unknown>,
  date: string,
  type: string,
  symbol: string,
  units: number,
  price: number,
  amount: number | null,
): string {
  const providerId =
    readString(row.id) ?? readString(row.transaction_id) ?? readString(row.activity_id);
  if (providerId) return snaptradeActivityExternalId(ctx.accountId, providerId);
  return snaptradeFallbackExternalId(ctx.accountId, {
    date,
    type,
    symbol,
    units,
    price,
    amount,
  });
}

/** Normalize one SnapTrade account activity into a canonical ledger draft (or a warning). */
export function normalizeSnaptradeActivity(
  row: Record<string, unknown>,
  ctx: SnapTradeNormalizeContext,
): SnapTradeNormalizeResult {
  const type = (readString(row.type) ?? "").toUpperCase();
  const sym =
    symbolFromUniversal(row.symbol) ??
    symbolFromUniversal(row.universal_symbol) ??
    symbolFromPosition(row);

  const date = ymdFromIso(readString(row.trade_date) ?? readString(row.date));
  const settlementDate = ymdFromIso(readString(row.settlement_date));
  const currency =
    readCurrencyCode(row.currency) ?? readCurrencyCode(asRecord(row.symbol)?.currency) ?? "USD";

  const units = Math.abs(readNumber(row.units) ?? readNumber(row.quantity) ?? 0);
  const price = readNumber(row.price) ?? 0;
  const amount = readNumber(row.amount);
  const fee = Math.abs(readNumber(row.fee) ?? 0);

  const unknown = (extra?: Record<string, unknown>): SnapTradeNormalizeResult => ({
    draft: null,
    warning: {
      code: "UNKNOWN_ACTIVITY",
      message: `Unmapped SnapTrade activity type "${type || "(empty)"}" was skipped and not imported.`,
      accountId: ctx.accountId,
      activityType: type || undefined,
      symbol: sym?.symbol,
      detail: { date, units, price, amount, ...extra },
    },
  });

  if (!date) return unknown({ reason: "missing_date" });

  const finish = (
    draft: SnapTradeSyncDraftTransaction,
    idSymbol: string,
  ): SnapTradeNormalizeResult => {
    const externalId = activityExternalId(ctx, row, date, type, idSymbol, units, price, amount);
    const stamped = withProvenance(draft, ctx, externalId, type, currency);
    if (settlementDate) stamped.settlementDate = settlementDate;
    return { draft: stamped, warning: null };
  };

  if (type.includes("DIVIDEND")) {
    if (!sym) return unknown({ reason: "missing_symbol" });
    const sum = amount ?? units * price;
    if (!Number.isFinite(sum) || sum === 0) return unknown({ reason: "zero_amount" });
    return finish(
      {
        kind: "income",
        operation: "Dividend",
        symbol: sym.symbol,
        name: sym.name,
        logoUrl: null,
        date,
        shares: Math.abs(sum),
        price: 1,
        fee: 0,
        sum: Math.abs(sum),
        profitPct: null,
        profitUsd: null,
      },
      sym.symbol,
    );
  }

  if (type.includes("INTEREST") || type === "INCOME") {
    const sum = amount ?? 0;
    if (!Number.isFinite(sum) || sum === 0) return unknown({ reason: "zero_amount" });
    return finish(
      {
        kind: "income",
        operation: "Other income",
        symbol: "USD",
        name: "US Dollar",
        logoUrl: null,
        date,
        shares: Math.abs(sum),
        price: 1,
        fee: 0,
        sum: Math.abs(sum),
        profitPct: null,
        profitUsd: null,
      },
      "USD",
    );
  }

  if (type.includes("FEE") || type.includes("TAX") || type.includes("WITHHOLDING")) {
    const raw = amount ?? -fee;
    const abs = Math.abs(raw);
    if (!Number.isFinite(abs) || abs === 0) return unknown({ reason: "zero_amount" });
    return finish(
      {
        kind: "expense",
        operation: "Other expense",
        symbol: sym?.symbol ?? "USD",
        name: sym?.name ?? "US Dollar",
        logoUrl: null,
        date,
        shares: abs,
        price: 1,
        fee: 0,
        sum: -abs,
        profitPct: null,
        profitUsd: null,
      },
      sym?.symbol ?? "USD",
    );
  }

  if (type.includes("BUY") || type === "PURCHASE") {
    if (!sym) return unknown({ reason: "missing_symbol" });
    if (units <= 0 || price <= 0) return unknown({ reason: "invalid_units_or_price" });
    const sum = amount ?? -(units * price + fee);
    return finish(
      {
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
      },
      sym.symbol,
    );
  }

  if (type.includes("SELL") || type === "SALE") {
    if (!sym) return unknown({ reason: "missing_symbol" });
    if (units <= 0 || price <= 0) return unknown({ reason: "invalid_units_or_price" });
    const sum = amount ?? units * price - fee;
    return finish(
      {
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
      },
      sym.symbol,
    );
  }

  const isTransfer = type.includes("TRANSFER");
  if (isTransfer && sym && units > 0 && price > 0) {
    const isOut = type.includes("OUT") || (amount != null && amount > 0);
    return finish(
      {
        kind: "trade",
        operation: isOut ? "Sell" : "Buy",
        symbol: sym.symbol,
        name: sym.name,
        logoUrl: null,
        date,
        shares: units,
        price,
        fee: 0,
        sum: isOut ? units * price : -(units * price),
        profitPct: null,
        profitUsd: null,
      },
      sym.symbol,
    );
  }

  const cashClass = classifySnaptradeCashActivityType(type, Boolean(sym));
  if (cashClass) {
    const raw = amount ?? readNumber(row.units);
    if (raw == null || raw === 0) return unknown({ reason: "zero_amount" });
    const signed =
      cashClass === "out"
        ? -Math.abs(raw)
        : cashClass === "in"
          ? Math.abs(raw)
          : raw;
    const abs = Math.abs(signed);
    return finish(
      {
        kind: "cash",
        operation: signed >= 0 ? "Cash In" : "Cash Out",
        symbol: "USD",
        name: "US Dollar",
        logoUrl: null,
        date,
        shares: abs,
        price: 1,
        fee: 0,
        sum: signed,
        profitPct: null,
        profitUsd: null,
      },
      "USD",
    );
  }

  return unknown();
}

/** Normalize one executed order fallback into a canonical trade draft (or a warning / ignore). */
export function normalizeSnaptradeOrder(
  row: Record<string, unknown>,
  ctx: SnapTradeNormalizeContext,
  /** Fixed clock for missing timestamps — tests must pass this for determinism. */
  nowYmd?: string,
): SnapTradeNormalizeResult {
  const status = (readString(row.status) ?? "").toUpperCase();
  const filled = readNumber(row.filled_quantity) ?? readNumber(row.filledQuantity) ?? 0;
  // Never import open Alpaca/SnapTrade orders (NEW / PENDING / ACCEPTED) — even if
  // total_quantity is set. Only positive filled_quantity on a fill-eligible status.
  if (!isSnaptradeOrderFillEligible({ status, filledQuantity: filled })) {
    return { draft: null, warning: null };
  }

  const sym = symbolFromUniversal(row.universal_symbol);
  if (!sym) {
    return {
      draft: null,
      warning: {
        code: "UNMAPPED_ORDER",
        message: "Executed order skipped: could not resolve its symbol.",
        accountId: ctx.accountId,
        detail: { status },
      },
    };
  }

  // Always use filled size — never fall back to total_quantity (that is the open order size).
  const shares = filled;
  const price = readNumber(row.execution_price) ?? readNumber(row.executionPrice) ?? 0;
  if (shares <= 0 || price <= 0) {
    return {
      draft: null,
      warning: {
        code: "UNMAPPED_ORDER",
        message: `Executed order for ${sym.symbol} skipped: missing filled quantity or execution price.`,
        accountId: ctx.accountId,
        symbol: sym.symbol,
        detail: { shares, price, status },
      },
    };
  }

  const date =
    ymdFromIso(readString(row.time_executed) ?? readString(row.time_placed)) ??
    nowYmd ??
    format(new Date(), "yyyy-MM-dd");
  const action = (readString(row.action) ?? "BUY").toUpperCase();
  const isBuy = action.includes("BUY");
  const currency = readCurrencyCode(asRecord(row.universal_symbol)?.currency) ?? "USD";

  const orderId = readString(row.brokerage_order_id) ?? readString(row.id) ?? null;
  const externalId = orderId
    ? snaptradeOrderExternalId(ctx.accountId, orderId)
    : snaptradeFallbackExternalId(ctx.accountId, {
        kind: "order",
        date,
        action,
        symbol: sym.symbol,
        shares,
        price,
      });

  const draft: SnapTradeSyncDraftTransaction = {
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
  return { draft: withProvenance(draft, ctx, externalId, `ORDER_${action}`, currency), warning: null };
}

/** Batch-normalize activities; returns drafts + warnings (unsupported never enter the ledger). */
export function normalizeSnaptradeActivities(
  rows: readonly Record<string, unknown>[],
  ctx: SnapTradeNormalizeContext,
): { drafts: SnapTradeSyncDraftTransaction[]; warnings: SnapTradeNormalizeWarning[] } {
  const drafts: SnapTradeSyncDraftTransaction[] = [];
  const warnings: SnapTradeNormalizeWarning[] = [];
  for (const row of rows) {
    const { draft, warning } = normalizeSnaptradeActivity(row, ctx);
    if (draft) drafts.push(draft);
    if (warning) warnings.push(warning);
  }
  return { drafts, warnings };
}
