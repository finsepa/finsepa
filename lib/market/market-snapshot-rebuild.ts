/**
 * Distributed single-flight cold rebuild for durable `market_snapshot` aggregate blobs
 * (screener / markets / heatmap). Reuses asset rebuild lease RPCs with opaque keys.
 */

import "server-only";

import {
  ASSET_REBUILD_WAITER_POLL_MS,
  failAssetRebuildLease,
  newAssetRebuildLeaseOwner,
  releaseAssetRebuildLease,
  sleepMs,
  tryAcquireAssetRebuildLease,
} from "@/lib/market/asset-rebuild-lease";
import {
  createAssetColdMissMetrics,
  runColdMissSingleFlight,
  type AssetColdMissMetrics,
} from "@/lib/market/asset-rebuild-single-flight";
import type { MarketSnapshotKey } from "@/lib/market/market-snapshot-keys";
import {
  marketSnapshotHotSegment,
  marketSnapshotSlowSegment,
  readMarketSnapshot,
  readMarketSnapshotRow,
  readMarketSnapshotSlow,
  upsertMarketSnapshot,
  MARKET_SNAPSHOT_HOT_STALE_MS,
  MARKET_SNAPSHOT_SLOW_STALE_MS,
} from "@/lib/market/market-snapshot-store";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

/** Large screener blobs (500-symbol EOD) need a longer lease than equity SSR. */
export const MARKET_BLOB_REBUILD_LEASE_TTL_SEC = 180;
/** Wait long enough for stocks_all_pages / screener_derived leaders. */
export const MARKET_BLOB_REBUILD_WAITER_MAX_MS = 45_000;

export type MarketBlobTier = "hot" | "slow";

export type MarketBlobHit<T> = {
  payload: T;
  exactSegment: boolean;
};

function currentSegment(tier: MarketBlobTier): string {
  const epoch = getScreenerUsMarketCacheEpoch();
  return tier === "hot" ? marketSnapshotHotSegment(epoch) : marketSnapshotSlowSegment(epoch);
}

/**
 * Prefer exact, else prior row within the same stale window as normal reads.
 * Used by waiters so they never need a provider call.
 */
export async function readMarketBlobForRebuild<T>(
  key: MarketSnapshotKey,
  tier: MarketBlobTier,
): Promise<MarketBlobHit<T> | null> {
  const segment = currentSegment(tier);
  const exact =
    tier === "hot"
      ? await readMarketSnapshot<T>(key)
      : await readMarketSnapshotSlow<T>(key);

  // readMarketSnapshot already applies stale fallback for the current epoch —
  // but does not expose exactSegment. Treat any successful read as usable.
  if (exact != null) {
    const row = await readMarketSnapshotRow(key);
    return {
      payload: exact,
      exactSegment: row?.segment === segment,
    };
  }

  // Extra allow: if normal read returned null (e.g. frozen exact-miss), still try raw row
  // within a generous window so waiters/failed leaders preserve previous valid data.
  const row = await readMarketSnapshotRow(key);
  if (!row?.data) return null;
  const updated = Date.parse(row.updated_at);
  const maxAge = tier === "hot" ? MARKET_SNAPSHOT_HOT_STALE_MS * 4 : MARKET_SNAPSHOT_SLOW_STALE_MS;
  if (!Number.isFinite(updated) || Date.now() - updated > maxAge) return null;
  return { payload: row.data as T, exactSegment: false };
}

/**
 * Cold-miss path only: one leader rebuilds + awaits upsert; waiters poll / stale / empty.
 * Callers should still prefer a warm `readMarketSnapshot*` hit before invoking this.
 */
export async function rebuildMarketSnapshotBlobSingleFlight<T>(opts: {
  key: MarketSnapshotKey;
  tier: MarketBlobTier;
  loadUncached: () => Promise<T>;
  emptyFallback: () => T;
  isUsable?: (payload: T) => boolean;
  metrics?: AssetColdMissMetrics;
  /** Optional provider-call accounting for tests/simulations. */
  onProviderRebuild?: () => void;
}): Promise<T> {
  const segment = currentSegment(opts.tier);
  const key = opts.key;
  const isUsablePayload = opts.isUsable ?? ((p: T) => p != null);

  const result = await runColdMissSingleFlight<T, MarketBlobHit<T>>({
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(key, segment, ownerId, MARKET_BLOB_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(key, segment, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(key, segment, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: async () => {
      opts.onProviderRebuild?.();
      return opts.loadUncached();
    },
    persistSnapshot: async (page) => {
      const res = await upsertMarketSnapshot(key, segment, page);
      return res.ok ? { ok: true } : { ok: false, reason: res.reason };
    },
    readSnapshot: () => readMarketBlobForRebuild<T>(key, opts.tier),
    isUsableHit: (hit) => isUsablePayload(hit.payload),
    pageFromSnapshot: async (hit) => hit.payload,
    fallbackPage: opts.emptyFallback,
    sleep: sleepMs,
    now: () => Date.now(),
    waiterMaxMs: MARKET_BLOB_REBUILD_WAITER_MAX_MS,
    pollMs: ASSET_REBUILD_WAITER_POLL_MS,
    metrics: opts.metrics,
  });

  return result ?? opts.emptyFallback();
}

export { createAssetColdMissMetrics };
