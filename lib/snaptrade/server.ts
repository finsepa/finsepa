import "server-only";

import { Snaptrade } from "snaptrade-typescript-sdk";

import {
  getSnapTradeClientId,
  getSnapTradeConsumerKey,
} from "@/lib/env/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export class SnapTradeNotConfiguredError extends Error {
  constructor() {
    super("SnapTrade is not configured.");
    this.name = "SnapTradeNotConfiguredError";
  }
}

export class SnapTradeUserStoreError extends Error {
  constructor(message = "SnapTrade user store is unavailable.") {
    super(message);
    this.name = "SnapTradeUserStoreError";
  }
}

type SnapTradeCredentials = {
  snaptradeUserId: string;
  userSecret: string;
};

function getSnapTradeClient(): Snaptrade {
  const clientId = getSnapTradeClientId();
  const consumerKey = getSnapTradeConsumerKey();
  if (!clientId || !consumerKey) {
    throw new SnapTradeNotConfiguredError();
  }
  return new Snaptrade({ clientId, consumerKey });
}

export function isSnapTradeConfigured(): boolean {
  return Boolean(getSnapTradeClientId() && getSnapTradeConsumerKey());
}

function snaptradeUserIdForFinsepaUser(finsepaUserId: string): string {
  return finsepaUserId;
}

async function readStoredCredentials(userId: string): Promise<SnapTradeCredentials | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("snaptrade_users")
    .select("snaptrade_user_id,user_secret")
    .eq("user_id", userId)
    .maybeSingle<{ snaptrade_user_id: string; user_secret: string }>();

  if (error) {
    console.error("[snaptrade] readStoredCredentials", error.message);
    return null;
  }
  if (!data?.snaptrade_user_id || !data.user_secret) return null;

  return {
    snaptradeUserId: data.snaptrade_user_id,
    userSecret: data.user_secret,
  };
}

async function storeCredentials(
  userId: string,
  credentials: SnapTradeCredentials,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new SnapTradeUserStoreError();

  const now = new Date().toISOString();
  const { error } = await admin.from("snaptrade_users").upsert(
    {
      user_id: userId,
      snaptrade_user_id: credentials.snaptradeUserId,
      user_secret: credentials.userSecret,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[snaptrade] storeCredentials", error.message);
    throw new SnapTradeUserStoreError("Failed to store SnapTrade credentials.");
  }
}

export async function ensureSnapTradeUser(userId: string): Promise<SnapTradeCredentials> {
  const existing = await readStoredCredentials(userId);
  if (existing) return existing;

  const snaptrade = getSnapTradeClient();
  const snaptradeUserId = snaptradeUserIdForFinsepaUser(userId);

  const registerResponse = (
    await snaptrade.authentication.registerSnapTradeUser({ userId: snaptradeUserId })
  ).data;

  const userSecret =
    typeof registerResponse.userSecret === "string" ? registerResponse.userSecret.trim() : "";
  if (!userSecret) {
    throw new Error("SnapTrade did not return a user secret.");
  }

  const credentials = { snaptradeUserId, userSecret };
  await storeCredentials(userId, credentials);
  return credentials;
}

function extractRedirectUri(data: unknown): string {
  if (!data || typeof data !== "object") {
    throw new Error("SnapTrade login response was empty.");
  }
  const redirectUri = (data as { redirectURI?: unknown }).redirectURI;
  if (typeof redirectUri !== "string" || !redirectUri.trim()) {
    throw new Error("SnapTrade login response did not include a redirect URI.");
  }
  return redirectUri.trim();
}

export async function createSnapTradePortalLink(
  userId: string,
  options?: { reconnectAuthorizationId?: string | null },
): Promise<string> {
  const credentials = await ensureSnapTradeUser(userId);
  const snaptrade = getSnapTradeClient();

  const loginResponse = await snaptrade.authentication.loginSnapTradeUser({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    connectionType: "read",
    connectionPortalVersion: "v4",
    reconnect: options?.reconnectAuthorizationId ?? undefined,
  });

  return extractRedirectUri(loginResponse.data);
}

export async function listSnapTradeConnections(userId: string) {
  const credentials = await ensureSnapTradeUser(userId);
  const snaptrade = getSnapTradeClient();

  const response = await snaptrade.connections.listBrokerageAuthorizations({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
  });

  const rows = Array.isArray(response.data) ? response.data : [];
  return rows
    .map((row) => {
      const id = typeof row.id === "string" ? row.id : null;
      if (!id) return null;
      const brokerage =
        row.brokerage && typeof row.brokerage === "object" ?
          (row.brokerage as { name?: unknown; slug?: unknown })
        : null;
      return {
        id,
        name: typeof row.name === "string" ? row.name : null,
        brokerageName: typeof brokerage?.name === "string" ? brokerage.name : null,
        brokerageSlug: typeof brokerage?.slug === "string" ? brokerage.slug : null,
        disabled: row.disabled === true,
        createdDate: typeof row.created_date === "string" ? row.created_date : null,
        connectionType: typeof row.type === "string" ? row.type : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export async function deleteSnapTradeConnection(
  userId: string,
  authorizationId: string,
): Promise<void> {
  const credentials = await ensureSnapTradeUser(userId);
  const snaptrade = getSnapTradeClient();

  await snaptrade.connections.deleteConnection({
    userId: credentials.snaptradeUserId,
    userSecret: credentials.userSecret,
    connectionId: authorizationId,
  });
}
