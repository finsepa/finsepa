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

/** How long a prior-segment asset snapshot stays usable (hot-refresh only; skips full EODHD fan-out). */
export const ASSET_SNAPSHOT_STALE_MAX_MS = 6 * 60 * 60 * 1000;

export async function readAssetSnapshot(
  ticker: string,
  segment: string,
): Promise<AssetSnapshotPayload | null> {
  const hit = await readAssetSnapshotForPage(ticker, segment, { allowStale: false });
  return hit?.payload ?? null;
}

/**
 * Exact segment match, or — when `allowStale` — last snapshot within {@link ASSET_SNAPSHOT_STALE_MAX_MS}.
 * Stale hits let mid-tier tickers (e.g. NFLX) avoid a cold ~11-call EODHD fan-out every 15m market segment.
 */
export async function readAssetSnapshotForPage(
  ticker: string,
  segment: string,
  opts?: { allowStale?: boolean; maxStaleMs?: number },
): Promise<{ payload: AssetSnapshotPayload; exactSegment: boolean } | null> {
  const key = assetSnapshotKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.data) return null;
  const payload = data.data as AssetSnapshotPayload;
  if (!payload || typeof payload !== "object" || payload.ticker !== ticker.trim().toUpperCase()) {
    return null;
  }

  if (data.segment === segment) {
    return { payload, exactSegment: true };
  }

  if (!opts?.allowStale) return null;

  const maxStale = opts.maxStaleMs ?? ASSET_SNAPSHOT_STALE_MAX_MS;
  const updatedAt = Date.parse(typeof data.updated_at === "string" ? data.updated_at : "");
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxStale) return null;

  return { payload, exactSegment: false };
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
