//
// Asset rebuild lease — distributed single-flight for cold market_snapshot misses.
//

import "server-only";

import { randomUUID } from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const ASSET_REBUILD_LEASE_TTL_SEC = 60;
export const ASSET_REBUILD_WAITER_MAX_MS = 10_000;
export const ASSET_REBUILD_WAITER_POLL_MS = 300;

export type AssetRebuildLeaseOwner = string;

export function newAssetRebuildLeaseOwner(): AssetRebuildLeaseOwner {
  return randomUUID();
}

/** True if this owner acquired the lease (leader). False = waiter. Null = lease infra unavailable. */
export async function tryAcquireAssetRebuildLease(
  key: string,
  segment: string,
  ownerId: AssetRebuildLeaseOwner,
  ttlSeconds: number = ASSET_REBUILD_LEASE_TTL_SEC,
): Promise<boolean | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("try_acquire_asset_rebuild_lease", {
    p_key: key,
    p_segment: segment,
    p_owner: ownerId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    console.warn("[asset-rebuild-lease] acquire failed", { key, segment, message: error.message });
    return null;
  }
  return data === true;
}

export async function releaseAssetRebuildLease(
  key: string,
  segment: string,
  ownerId: AssetRebuildLeaseOwner,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("release_asset_rebuild_lease", {
    p_key: key,
    p_segment: segment,
    p_owner: ownerId,
  });
  if (error) {
    console.warn("[asset-rebuild-lease] release failed", { key, segment, message: error.message });
  }
}

export async function failAssetRebuildLease(
  key: string,
  segment: string,
  ownerId: AssetRebuildLeaseOwner,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("fail_asset_rebuild_lease", {
    p_key: key,
    p_segment: segment,
    p_owner: ownerId,
  });
  if (error) {
    console.warn("[asset-rebuild-lease] fail mark failed", { key, segment, message: error.message });
  }
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
