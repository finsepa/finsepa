import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

import type { HubSnapshotKey } from "@/lib/market/hub-snapshot-keys";

export type HubSnapshotRow = {
  key: string;
  segment: string;
  data: unknown;
  updated_at: string;
};

/** Prior-segment hub rows remain usable for user reads (news prefers stale over cold rebuild). */
export const HUB_SNAPSHOT_STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export async function readHubSnapshot<T>(
  key: HubSnapshotKey,
  segment: string,
  opts?: { allowStale?: boolean; maxStaleMs?: number },
): Promise<T | null> {
  const hit = await readHubSnapshotForPage<T>(key, segment, opts);
  return hit?.payload ?? null;
}

/**
 * Exact segment match, or — when `allowStale` — last row for this key within max age.
 * Used so hub pages (news) never cold-rebuild from user traffic on day-segment roll.
 */
export async function readHubSnapshotForPage<T>(
  key: HubSnapshotKey,
  segment: string,
  opts?: { allowStale?: boolean; maxStaleMs?: number },
): Promise<{ payload: T; exactSegment: boolean; updatedAt: string } | null> {
  if (!marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data || data.data === null || data.data === undefined) return null;

  const updatedAt = typeof data.updated_at === "string" ? data.updated_at : "";
  if (data.segment === segment) {
    return { payload: data.data as T, exactSegment: true, updatedAt };
  }

  if (!opts?.allowStale) return null;

  const maxStale = opts.maxStaleMs ?? HUB_SNAPSHOT_STALE_MAX_MS;
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs) || Date.now() - updatedMs > maxStale) return null;

  return { payload: data.data as T, exactSegment: false, updatedAt };
}

export async function readHubSnapshotRow(key: HubSnapshotKey): Promise<HubSnapshotRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data as HubSnapshotRow;
}

export async function upsertHubSnapshot(
  key: HubSnapshotKey,
  segment: string,
  payload: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (payload === null || payload === undefined) {
    return { ok: false, reason: "empty_payload" };
  }

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

export async function hubSnapshotRowIsFresh(
  key: HubSnapshotKey,
  segment: string,
  maxAgeMs: number,
): Promise<boolean> {
  const row = await readHubSnapshotRow(key);
  if (!row || row.segment !== segment) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated < maxAgeMs;
}
