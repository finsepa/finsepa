export type PortfolioPrivacy = "private" | "public";

export type ConnectBrokerageCompletePayload = {
  name: string;
  privacy: PortfolioPrivacy;
  authorizationId: string;
  /**
   * When set, sync into this portfolio instead of creating a new one:
   * - already linked / offline → reconnect + resync
   * - empty manual → first SnapTrade link (keeps name & privacy)
   */
  reconnectPortfolioId?: string;
};

export type PortfolioKind = "standard" | "combined" | "demo";

import {
  normalizePortfolioSnaptradeSyncSettings,
  type PortfolioSnaptradeSyncSettings,
} from "@/lib/snaptrade/sync-settings";

export type { PortfolioSnaptradeSyncSettings };

export type PortfolioSnaptradeLink = {
  /**
   * SnapTrade authorization id while connected.
   * When {@link offline}, may be a stale id kept for reconnection attempts, or empty.
   */
  authorizationId: string;
  accountIds: string[];
  brokerageName: string | null;
  brokerageSlug?: string | null;
  brokerageLogoUrl?: string | null;
  /** SnapTrade brokerage.supports real-time holdings on API fetch. */
  isRealTimeConnection?: boolean;
  syncedAt: string;
  syncSettings?: PortfolioSnaptradeSyncSettings;
  /**
   * True when Free/disconnected: holdings+ledger frozen, SnapTrade link should be torn down.
   * User can open the portfolio read-only; reconnect requires Pro.
   */
  offline?: boolean;
  /** ISO time when portfolio was marked offline (optional). */
  offlineAt?: string;
};

export type PortfolioEntry = {
  id: string;
  name: string;
  privacy: PortfolioPrivacy;
  kind?: PortfolioKind;
  /** Sample portfolio for Free — does not count toward Free portfolio quota. */
  isDemo?: boolean;
  /** When `kind` is `combined`, IDs of standard portfolios merged into this view (read-only aggregate). */
  combinedFrom?: string[];
  /** Present when portfolio was created via Connect brokerage. */
  snaptrade?: PortfolioSnaptradeLink;
};

export function portfolioIsCombined(p: PortfolioEntry | null | undefined): boolean {
  return p?.kind === "combined" && Array.isArray(p.combinedFrom) && p.combinedFrom.length >= 2;
}

export function portfolioIsDemo(p: PortfolioEntry | null | undefined): boolean {
  return p?.isDemo === true || p?.kind === "demo";
}

/** Default display name for Free demo sample portfolios. */
export const DEFAULT_DEMO_PORTFOLIO_NAME = "Finsepa Demo";
/** Prior seed titles — rewritten on normalize so existing demos rename once. */
const LEGACY_DEMO_PORTFOLIO_NAMES = new Set([
  "Demo portfolio",
  "Demo Portfolio",
  "Finsepa Portfolio",
  "Finsepa Demo Portfolio",
]);

/** True when this portfolio originated from brokerage (live or offline freeze). */
export function portfolioIsBrokerageOrigin(p: PortfolioEntry | null | undefined): boolean {
  return p?.snaptrade != null;
}

/** True when SnapTrade is live (not Free offline freeze). */
export function portfolioIsLiveBrokerage(p: PortfolioEntry | null | undefined): boolean {
  const s = p?.snaptrade;
  if (!s || s.offline) return false;
  return Boolean(s.authorizationId?.trim());
}

/** Frozen brokerage book after disconnect / Free demotion. */
export function portfolioIsOfflineBrokerage(p: PortfolioEntry | null | undefined): boolean {
  return p?.snaptrade?.offline === true;
}

/** Subtitle for portfolio picker rows (combined / SnapTrade / manual / empty). */
export function portfolioKindSubtext(
  p: PortfolioEntry,
  opts?: { emptyLedger?: boolean },
): string {
  if (
    opts?.emptyLedger &&
    !portfolioIsDemo(p) &&
    !portfolioIsCombined(p) &&
    !portfolioIsBrokerageOrigin(p)
  ) {
    return "Not configured";
  }
  if (portfolioIsDemo(p)) return "Demo";
  if (portfolioIsCombined(p)) return "Combined portfolio";
  if (portfolioIsOfflineBrokerage(p)) return "Brokerage · offline";
  if (p.snaptrade) return "Brokerage";
  return "Manual";
}

/** Coerce persisted / partial rows to a full entry (missing privacy → private). */
export function normalizePortfolioEntry(p: {
  id: string;
  name: string;
  privacy?: unknown;
  kind?: unknown;
  isDemo?: unknown;
  combinedFrom?: unknown;
  snaptrade?: unknown;
}): PortfolioEntry {
  const privacy: PortfolioPrivacy = p.privacy === "public" ? "public" : "private";
  const isDemo = p.isDemo === true || p.kind === "demo";
  const rawName = typeof p.name === "string" ? p.name.trim() : "";
  const name =
    isDemo && (rawName === "" || LEGACY_DEMO_PORTFOLIO_NAMES.has(rawName))
      ? DEFAULT_DEMO_PORTFOLIO_NAME
      : rawName || "Portfolio";
  const base: PortfolioEntry = {
    id: p.id,
    name,
    privacy: isDemo ? "private" : privacy,
    ...(isDemo ? { isDemo: true, kind: "demo" as const } : {}),
  };

  const snaptrade = normalizePortfolioSnaptradeLink(p.snaptrade);
  const withSnaptrade = snaptrade && !isDemo ? { ...base, snaptrade } : base;

  if (isDemo) return withSnaptrade;

  const kind = p.kind === "combined" ? "combined" : "standard";
  const combinedFrom =
    kind === "combined" && Array.isArray(p.combinedFrom)
      ? p.combinedFrom.filter((x): x is string => typeof x === "string")
      : undefined;

  if (kind === "combined" && combinedFrom && combinedFrom.length >= 2) {
    return { ...withSnaptrade, kind: "combined", combinedFrom };
  }
  return withSnaptrade;
}

function normalizePortfolioSnaptradeLink(raw: unknown): PortfolioSnaptradeLink | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const offline = o.offline === true;
  const authorizationId = typeof o.authorizationId === "string" ? o.authorizationId.trim() : "";
  // Live links require an authorization id. Offline freezes may keep a stale/empty id.
  if (!authorizationId && !offline) return undefined;
  const accountIds = Array.isArray(o.accountIds)
    ? o.accountIds.filter((x): x is string => typeof x === "string")
    : [];
  const brokerageName = typeof o.brokerageName === "string" ? o.brokerageName : null;
  const brokerageSlug = typeof o.brokerageSlug === "string" ? o.brokerageSlug : null;
  const brokerageLogoUrl = typeof o.brokerageLogoUrl === "string" ? o.brokerageLogoUrl : null;
  const isRealTimeConnection =
    o.isRealTimeConnection === true ? true : o.isRealTimeConnection === false ? false : undefined;
  const syncedAt = typeof o.syncedAt === "string" ? o.syncedAt : new Date().toISOString();
  const offlineAt = typeof o.offlineAt === "string" ? o.offlineAt : undefined;
  const syncSettings = normalizePortfolioSnaptradeSyncSettings(o.syncSettings);
  return {
    authorizationId: authorizationId || (offline ? "offline" : authorizationId),
    accountIds,
    brokerageName,
    brokerageSlug,
    brokerageLogoUrl,
    ...(isRealTimeConnection !== undefined ? { isRealTimeConnection } : {}),
    syncedAt,
    syncSettings,
    ...(offline ? { offline: true as const, ...(offlineAt ? { offlineAt } : {}) } : {}),
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
  /**
   * Canonical order within the portfolio (Phase 1). Assigned on migration / new writes.
   * Sort key: date → sequence → id.
   */
  sequence?: number;
  /** ISO timestamp when the row was created or first migrated (optional, additive). */
  createdAt?: string;
  /**
   * Pre-existing orphan/oversell sell discovered on migration. Display replay soft-handles these;
   * new mutations must not introduce untagged anomalies.
   */
  legacyAnomaly?: boolean;

  // ── Phase 5B provenance (additive, optional). Missing `source` ⇒ MANUAL. ──
  /**
   * Row provenance. Undefined is treated as `MANUAL` everywhere (see `transactionSource`).
   * `SNAPTRADE` = broker-imported row; `SNAPTRADE_ADJUSTMENT` = synthetic reconciliation row.
   * Broker sources are immutable in the UI (read-only).
   */
  source?: "MANUAL" | "SNAPTRADE" | "SNAPTRADE_ADJUSTMENT";
  /** Upstream provider that produced the row. */
  provider?: "SNAPTRADE";
  /** Stable provider identity used for idempotent upsert (e.g. `snaptrade:activity:{acct}:{id}`). */
  externalId?: string;
  /** SnapTrade account id the row was imported from. */
  externalAccountId?: string;
  /** SnapTrade brokerage authorization id. */
  externalAuthorizationId?: string;
  /** Raw provider activity/order type (for diagnostics / future re-mapping). */
  externalActivityType?: string;
  /** Provider settlement date (yyyy-MM-dd) when distinct from trade `date`. */
  settlementDate?: string;
  /** ISO timestamp the row was first imported from the provider. */
  importedAt?: string;
  /** ISO timestamp of the most recent sync that touched the row. */
  lastSyncedAt?: string;
  /** ISO 4217 currency code for the row (defaults to USD when absent). */
  currency?: string;
};

export function newTransactionRowId(): string {
  return newPortfolioId();
}
