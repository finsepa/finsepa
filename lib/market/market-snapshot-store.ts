import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

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

/**
 * Read a snapshot row when segment matches the current US market window.
 * Returns null when disabled, missing, stale segment, or Supabase unavailable.
 */
export async function readMarketSnapshot<T>(key: MarketSnapshotKey): Promise<T | null> {
  if (!marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const epoch = getScreenerUsMarketCacheEpoch();
  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (data.segment !== epoch.segment) return null;
  return data.data as T;
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

/** True when frozen segment already ingested — skip redundant cron EODHD work. */
export async function marketSnapshotSegmentIsFresh(segment: string, maxAgeMs: number): Promise<boolean> {
  const row = await readMarketSnapshotRow(MARKET_SNAPSHOT_KEY.stocksAllPages);
  if (!row || row.segment !== segment) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated < maxAgeMs;
}
