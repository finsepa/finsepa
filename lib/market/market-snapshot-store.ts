import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getScreenerUsMarketCacheEpoch,
  type ScreenerUsMarketCacheEpoch,
} from "@/lib/screener/screener-us-market-cache";

import { MARKET_SNAPSHOT_KEY, type MarketSnapshotKey } from "@/lib/market/market-snapshot-keys";

export type MarketSnapshotRow = {
  key: string;
  segment: string;
  data: unknown;
  updated_at: string;
};

export function marketSnapshotReadEnabled(): boolean {
  return process.env.FINSEPA_MARKET_SNAPSHOT_READ !== "0";
}

/** Live/frozen quote segment (15m slot during regular session). */
export function marketSnapshotHotSegment(epoch: ScreenerUsMarketCacheEpoch): string {
  return epoch.segment;
}

/**
 * EOD-derived segment: same as hot when frozen; one row per regular session day when live.
 * Avoids re-fetching hundreds of daily bars on every 15m cron tick.
 */
export function marketSnapshotSlowSegment(epoch: ScreenerUsMarketCacheEpoch): string {
  if (epoch.mode === "frozen") return epoch.segment;
  return `slow-live-${epoch.lastRegularSessionYmd}`;
}

async function readMarketSnapshotForSegment<T>(key: MarketSnapshotKey, segment: string): Promise<T | null> {
  if (!marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (data.segment !== segment) return null;
  return data.data as T;
}

/**
 * Read a hot-tier snapshot when segment matches the current US market window.
 * Returns null when disabled, missing, stale segment, or Supabase unavailable.
 */
export async function readMarketSnapshot<T>(key: MarketSnapshotKey): Promise<T | null> {
  const epoch = getScreenerUsMarketCacheEpoch();
  return readMarketSnapshotForSegment<T>(key, marketSnapshotHotSegment(epoch));
}

/** Read EOD-derived snapshot (session-day segment during live hours). */
export async function readMarketSnapshotSlow<T>(key: MarketSnapshotKey): Promise<T | null> {
  const epoch = getScreenerUsMarketCacheEpoch();
  return readMarketSnapshotForSegment<T>(key, marketSnapshotSlowSegment(epoch));
}

export async function readMarketSnapshotRow(key: MarketSnapshotKey): Promise<MarketSnapshotRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data as MarketSnapshotRow;
}

export async function upsertMarketSnapshot(
  key: MarketSnapshotKey,
  segment: string,
  payload: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
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

export async function marketSnapshotKeyIsFresh(
  key: MarketSnapshotKey,
  segment: string,
  maxAgeMs: number,
): Promise<boolean> {
  const row = await readMarketSnapshotRow(key);
  if (!row || row.segment !== segment) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated < maxAgeMs;
}

/** True when canonical hot row already ingested for this segment. */
export async function marketSnapshotSegmentIsFresh(segment: string, maxAgeMs: number): Promise<boolean> {
  return marketSnapshotKeyIsFresh(MARKET_SNAPSHOT_KEY.stocksAllPages, segment, maxAgeMs);
}
