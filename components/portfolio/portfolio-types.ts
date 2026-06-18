export type PortfolioPrivacy = "private" | "public";

export type PortfolioKind = "standard" | "combined";

import {
  normalizePortfolioSnaptradeSyncSettings,
  type PortfolioSnaptradeSyncSettings,
} from "@/lib/snaptrade/sync-settings";

export type { PortfolioSnaptradeSyncSettings };

export type PortfolioSnaptradeLink = {
  authorizationId: string;
  accountIds: string[];
  brokerageName: string | null;
  brokerageSlug?: string | null;
  brokerageLogoUrl?: string | null;
  /** SnapTrade brokerage.supports real-time holdings on API fetch. */
  isRealTimeConnection?: boolean;
  syncedAt: string;
  syncSettings?: PortfolioSnaptradeSyncSettings;
};

export type PortfolioEntry = {
  id: string;
  name: string;
  privacy: PortfolioPrivacy;
  kind?: PortfolioKind;
  /** When `kind` is `combined`, IDs of standard portfolios merged into this view (read-only aggregate). */
  combinedFrom?: string[];
  /** Present when portfolio was created via Connect brokerage. */
  snaptrade?: PortfolioSnaptradeLink;
};

export function portfolioIsCombined(p: PortfolioEntry | null | undefined): boolean {
  return p?.kind === "combined" && Array.isArray(p.combinedFrom) && p.combinedFrom.length >= 2;
}

/** Coerce persisted / partial rows to a full entry (missing privacy → private). */
export function normalizePortfolioEntry(p: {
  id: string;
  name: string;
  privacy?: unknown;
  kind?: unknown;
  combinedFrom?: unknown;
  snaptrade?: unknown;
}): PortfolioEntry {
  const privacy: PortfolioPrivacy = p.privacy === "public" ? "public" : "private";
  const base: PortfolioEntry = { id: p.id, name: p.name, privacy };

  const snaptrade = normalizePortfolioSnaptradeLink(p.snaptrade);
  const withSnaptrade = snaptrade ? { ...base, snaptrade } : base;

  const kind = p.kind === "combined" ? "combined" : "standard";
  const combinedFrom =
    kind === "combined" && Array.isArray(p.combinedFrom) ?
      p.combinedFrom.filter((x): x is string => typeof x === "string")
    : undefined;

  if (kind === "combined" && combinedFrom && combinedFrom.length >= 2) {
    return { ...withSnaptrade, kind: "combined", combinedFrom };
  }
  return withSnaptrade;
}

function normalizePortfolioSnaptradeLink(raw: unknown): PortfolioSnaptradeLink | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const authorizationId = typeof o.authorizationId === "string" ? o.authorizationId.trim() : "";
  if (!authorizationId) return undefined;
  const accountIds = Array.isArray(o.accountIds)
    ? o.accountIds.filter((x): x is string => typeof x === "string")
    : [];
  const brokerageName = typeof o.brokerageName === "string" ? o.brokerageName : null;
  const brokerageSlug = typeof o.brokerageSlug === "string" ? o.brokerageSlug : null;
  const brokerageLogoUrl = typeof o.brokerageLogoUrl === "string" ? o.brokerageLogoUrl : null;
  const isRealTimeConnection = o.isRealTimeConnection === true ? true : o.isRealTimeConnection === false ? false : undefined;
  const syncedAt = typeof o.syncedAt === "string" ? o.syncedAt : new Date().toISOString();
  const syncSettings = normalizePortfolioSnaptradeSyncSettings(o.syncSettings);
  return {
    authorizationId,
    accountIds,
    brokerageName,
    brokerageSlug,
    brokerageLogoUrl,
    ...(isRealTimeConnection !== undefined ? { isRealTimeConnection } : {}),
    syncedAt,
    syncSettings,
  };
}

/** One lot / line in the portfolio holdings table (local UI until backend exists). */
export type PortfolioHolding = {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  shares: number;
  /** Weighted average cost per share including fees (total paid ÷ shares). */
  avgPrice: number;
  /** Total amount paid for shares still held (incl. fees). Does not float with the stock price. */
  costBasis: number;
  currentValue: number;
  /** Last market price used for current value. */
  marketPrice: number;
};

export function newPortfolioId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2, 12)}`;
}

export function newHoldingId(): string {
  return newPortfolioId();
}

export type PortfolioTransactionKind = "trade" | "cash" | "income" | "expense";

/** Ledger row for the Transactions tab (local UI until backend exists). */
export type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  kind: PortfolioTransactionKind;
  /** Buy, Sell, Cash In, Cash Out, Dividend, Other expense, … */
  operation: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** ISO date yyyy-MM-dd */
  date: string;
  shares: number;
  price: number;
  fee: number;
  /** Signed cash flow: negative = paid out, positive = received. */
  sum: number;
  profitPct: number | null;
  profitUsd: number | null;
  /** Set for trade rows tied to a holding lot. */
  holdingId?: string;
  /** Optional memo (e.g. expense note). */
  note?: string | null;
};

export function newTransactionRowId(): string {
  return newPortfolioId();
}
