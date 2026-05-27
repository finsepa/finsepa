import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assetSnapshotKey } from "@/lib/market/asset-snapshot-keys";
import type { AssetSnapshotPayload } from "@/lib/market/asset-snapshot-payload";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export type AssetSnapshotRow = {
  key: string;
  segment: string;
  data: AssetSnapshotPayload;
  updated_at: string;
};

export async function readAssetSnapshot(
  ticker: string,
  segment: string,
): Promise<AssetSnapshotPayload | null> {
  const key = assetSnapshotKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (data.segment !== segment) return null;
  return data.data as AssetSnapshotPayload;
}

export async function upsertAssetSnapshot(
  ticker: string,
  segment: string,
  payload: AssetSnapshotPayload,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = assetSnapshotKey(ticker);
  if (!key) return { ok: false, reason: "invalid_ticker" };

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
