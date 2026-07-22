import "server-only";

import { format } from "date-fns";

import { ensureSnapTradeUser, getSnaptradeSdk } from "@/lib/snaptrade/server";
import { buildSnapTradeSyncTransactions } from "@/lib/snaptrade/build-sync-transactions";
import type {
  SnapTradeReconciliation,
  SnapTradeSyncDraftTransaction,
  SnapTradeSyncWarning,
} from "@/lib/snaptrade/build-sync-transactions";
import {
  DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
  normalizePortfolioSnaptradeSyncSettings,
  type PortfolioSnaptradeSyncSettings,
} from "@/lib/snaptrade/sync-settings";
import { normalizeSnaptradeUpdateFromYmd } from "@/lib/snaptrade/sync-update-from";
import {
  readSnapTradeBrokerageLogoUrl,
  readSnapTradeBrokerageName,
  readSnapTradeBrokerageSlug,
  readSnapTradeIsRealTimeConnection,
} from "@/lib/snaptrade/brokerage-meta";

export type { SnapTradeSyncDraftTransaction, SnapTradeSyncWarning, SnapTradeReconciliation };

export type SnapTradeSyncResult = {
  authorizationId: string;
  brokerageName: string | null;
  brokerageSlug: string | null;
  brokerageLogoUrl: string | null;
  isRealTimeConnection: boolean;
  accountIds: string[];
  transactions: SnapTradeSyncDraftTransaction[];
  warnings: SnapTradeSyncWarning[];
  reconciliation: SnapTradeReconciliation;
  /** Canonical symbol → broker mark for quote fallback after sync. */
  brokerMarks: Record<string, number>;
};

function readString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

/**
 * Module-level serialization: overlapping syncs for the same {user, authorization} are chained
 * so they never race on the same provider connection / workspace state. Callers await the
 * shared promise; a fresh sync starts only after any in-flight one settles.
 */
const inFlightSyncByKey = new Map<string, Promise<SnapTradeSyncResult>>();

function syncLockKey(userId: string, authorizationId: string): string {
  return `${userId}:${authorizationId}`;
}

export async function syncSnapTradeAuthorization(
  userId: string,
  authorizationId: string,
  syncSettings: PortfolioSnaptradeSyncSettings = DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
  updateFromYmd: string | null = null,
): Promise<SnapTradeSyncResult> {
  const key = syncLockKey(userId, authorizationId);
  const previous = inFlightSyncByKey.get(key);

  const run = (async () => {
    // Wait for any overlapping sync on the same connection to finish first.
    if (previous) {
      try {
        await previous;
      } catch {
        /* prior failure must not block this attempt */
      }
    }
    return runSnapTradeAuthorizationSync(userId, authorizationId, syncSettings, updateFromYmd);
  })();

  inFlightSyncByKey.set(key, run);
  try {
    return await run;
  } finally {
    // Only clear if we are still the latest run for this key.
    if (inFlightSyncByKey.get(key) === run) inFlightSyncByKey.delete(key);
  }
}

async function runSnapTradeAuthorizationSync(
  userId: string,
  authorizationId: string,
  syncSettings: PortfolioSnaptradeSyncSettings,
  updateFromYmd: string | null,
): Promise<SnapTradeSyncResult> {
  const credentials = await ensureSnapTradeUser(userId);
  const snaptrade = getSnaptradeSdk();
  const syncDate = format(new Date(), "yyyy-MM-dd");

  const connectionsRes = await snaptrade.connections.listBrokerageAuthorizations({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
  });
  const connections = Array.isArray(connectionsRes.data) ? connectionsRes.data : [];
  const connection = connections.find((c) => c.id === authorizationId);
  if (!connection) {
    throw new Error("Brokerage connection not found. Try connecting again.");
  }

  const brokerage = connection.brokerage && typeof connection.brokerage === "object" ? connection.brokerage : null;
  const brokerageName = readSnapTradeBrokerageName(brokerage);
  const brokerageSlug = readSnapTradeBrokerageSlug(brokerage);
  const brokerageLogoUrl = readSnapTradeBrokerageLogoUrl(brokerage);
  const isRealTimeConnection = readSnapTradeIsRealTimeConnection(brokerage);

  const accountsRes = await snaptrade.accountInformation.listUserAccounts({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
  });
  const allAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
  const accounts = allAccounts.filter((a) => {
    const auth =
      readString((a as { brokerage_authorization?: unknown }).brokerage_authorization) ??
      readString((a as { brokerageAuthorization?: unknown }).brokerageAuthorization);
    return auth === authorizationId;
  });

  if (accounts.length === 0) {
    throw new Error("No accounts found for this brokerage connection yet. Wait a minute and try again.");
  }

  const accountIds = accounts
    .map((a) => readString((a as { id?: unknown }).id))
    .filter((id): id is string => Boolean(id));

  const { transactions, warnings, reconciliation, brokerMarks } = await buildSnapTradeSyncTransactions(
    snaptrade,
    credentials,
    accountIds,
    syncDate,
    authorizationId,
    normalizePortfolioSnaptradeSyncSettings(syncSettings),
    normalizeSnaptradeUpdateFromYmd(updateFromYmd),
  );

  return {
    authorizationId,
    brokerageName,
    brokerageSlug,
    brokerageLogoUrl,
    isRealTimeConnection,
    accountIds,
    transactions,
    warnings,
    reconciliation,
    brokerMarks,
  };
}

/** Latest connection when the portal does not return an authorization id. */
export async function latestSnapTradeAuthorizationId(userId: string): Promise<string | null> {
  const credentials = await ensureSnapTradeUser(userId);
  const snaptrade = getSnaptradeSdk();
  const response = await snaptrade.connections.listBrokerageAuthorizations({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
  });
  const rows = Array.isArray(response.data) ? response.data : [];
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const ad = readString(a.created_date) ?? "";
    const bd = readString(b.created_date) ?? "";
    return bd.localeCompare(ad);
  });
  return readString(sorted[0]?.id);
}
