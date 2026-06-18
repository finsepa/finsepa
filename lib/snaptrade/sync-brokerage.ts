import "server-only";

import { format } from "date-fns";

import { ensureSnapTradeUser, getSnaptradeSdk } from "@/lib/snaptrade/server";
import { buildSnapTradeSyncTransactions } from "@/lib/snaptrade/build-sync-transactions";
import type { SnapTradeSyncDraftTransaction } from "@/lib/snaptrade/build-sync-transactions";
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

export type { SnapTradeSyncDraftTransaction };

export type SnapTradeSyncResult = {
  authorizationId: string;
  brokerageName: string | null;
  brokerageSlug: string | null;
  brokerageLogoUrl: string | null;
  isRealTimeConnection: boolean;
  accountIds: string[];
  transactions: SnapTradeSyncDraftTransaction[];
};

function readString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

export async function syncSnapTradeAuthorization(
  userId: string,
  authorizationId: string,
  syncSettings: PortfolioSnaptradeSyncSettings = DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
  updateFromYmd: string | null = null,
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

  const transactions = await buildSnapTradeSyncTransactions(
    snaptrade,
    credentials,
    accountIds,
    syncDate,
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
