/**
 * Durable page snapshots for index / currency detail SSR (same market_snapshot table).
 * Keys: asset_index_{SYM}, asset_currency_{SYM}.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export const ROUTE_ASSET_PAGE_SNAPSHOT_STALE_MAX_MS = 6 * 60 * 60 * 1000;

export type RouteAssetPageKind = "index" | "currency";

export function routeAssetPageSnapshotKey(kind: RouteAssetPageKind, symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return "";
  return kind === "index" ? `asset_index_${sym}` : `asset_currency_${sym}`;
}

export function getRouteAssetPageCacheSegment(kind: RouteAssetPageKind, now: Date = new Date()): string {
  const slot = Math.floor(now.getTime() / (15 * 60 * 1000));
  const prefix = kind === "index" ? "index_page_v1" : "currency_page_v1";
  return `${prefix}:${slot}`;
}

export async function readRouteAssetPageSnapshot<T extends { routeSymbol: string }>(
  kind: RouteAssetPageKind,
  symbol: string,
  segment: string,
  opts?: { allowStale?: boolean; maxStaleMs?: number },
): Promise<{ payload: T; exactSegment: boolean } | null> {
  const key = routeAssetPageSnapshotKey(kind, symbol);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.data) return null;
  const payload = data.data as T;
  const sym = symbol.trim().toUpperCase();
  if (!payload || typeof payload !== "object" || payload.routeSymbol?.trim().toUpperCase() !== sym) {
    return null;
  }

  if (data.segment === segment) {
    return { payload, exactSegment: true };
  }

  if (!opts?.allowStale) return null;

  const maxStale = opts.maxStaleMs ?? ROUTE_ASSET_PAGE_SNAPSHOT_STALE_MAX_MS;
  const updatedAt = Date.parse(typeof data.updated_at === "string" ? data.updated_at : "");
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxStale) return null;

  return { payload, exactSegment: false };
}

export async function upsertRouteAssetPageSnapshot<T extends { routeSymbol: string }>(
  kind: RouteAssetPageKind,
  symbol: string,
  segment: string,
  payload: T,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = routeAssetPageSnapshotKey(kind, symbol);
  if (!key) return { ok: false, reason: "invalid_symbol" };

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, reason: "no_supabase_admin" };

  const { error } = await admin.from("market_snapshot").upsert(
    {
      key,
      segment,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
