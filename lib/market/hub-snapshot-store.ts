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

export async function readHubSnapshot<T>(key: HubSnapshotKey, segment: string): Promise<T | null> {
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
