//
// Cold-miss single-flight orchestration (testable deps).
// Leader: uncached rebuild → persist snapshot → then release lease.
// Waiter: never calls uncached; polls snapshot / stale / one re-acquire / fallback.
//

import type { AssetSnapshotPayload } from "@/lib/market/asset-snapshot-payload";
import type { ScreenerUsMarketCacheMode } from "@/lib/screener/screener-us-market-cache";

export type AssetSnapshotHit = {
  payload: AssetSnapshotPayload;
  exactSegment: boolean;
};

/** Generic cold-miss deps — used by equity assets, crypto, and market aggregate blobs. */
export type ColdMissSingleFlightDeps<TPage, THit> = {
  tryAcquire: (ownerId: string) => Promise<boolean | null>;
  release: (ownerId: string) => Promise<void>;
  markFailed: (ownerId: string) => Promise<void>;
  newOwnerId: () => string;
  loadUncached: () => Promise<TPage | null>;
  persistSnapshot: (page: TPage) => Promise<{ ok: boolean; reason?: string }>;
  readSnapshot: () => Promise<THit | null>;
  /** Waiter / stale identity check — must not call providers. */
  isUsableHit: (hit: THit) => boolean;
  pageFromSnapshot: (hit: THit) => Promise<TPage>;
  fallbackPage: () => TPage;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  waiterMaxMs: number;
  pollMs: number;
  metrics?: AssetColdMissMetrics;
};

/** @deprecated Prefer ColdMissSingleFlightDeps — kept for stock call sites / tests. */
export type AssetColdMissSingleFlightDeps<TPage> = {
  snapshotKey: string;
  ticker: string;
  segment: string;
  mode: ScreenerUsMarketCacheMode;
  tryAcquire: (ownerId: string) => Promise<boolean | null>;
  release: (ownerId: string) => Promise<void>;
  markFailed: (ownerId: string) => Promise<void>;
  newOwnerId: () => string;
  loadUncached: () => Promise<TPage | null>;
  persistSnapshot: (page: TPage) => Promise<{ ok: boolean; reason?: string }>;
  readSnapshot: () => Promise<AssetSnapshotHit | null>;
  pageFromSnapshot: (hit: AssetSnapshotHit) => Promise<TPage>;
  fallbackPage: () => TPage;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  waiterMaxMs: number;
  pollMs: number;
  metrics?: AssetColdMissMetrics;
};

export type AssetColdMissMetrics = {
  uncachedRebuilds: number;
  eodhdCalls: number;
  snapshotReads: number;
  leaseAcquireAttempts: number;
  leaseAcquired: number;
  waiterTimeouts: number;
  waiterStaleServes: number;
  waiterFallbackServes: number;
  persistOk: number;
  persistFail: number;
  leaderFailures: number;
  waiterLatenciesMs: number[];
};

export function createAssetColdMissMetrics(): AssetColdMissMetrics {
  return {
    uncachedRebuilds: 0,
    eodhdCalls: 0,
    snapshotReads: 0,
    leaseAcquireAttempts: 0,
    leaseAcquired: 0,
    waiterTimeouts: 0,
    waiterStaleServes: 0,
    waiterFallbackServes: 0,
    persistOk: 0,
    persistFail: 0,
    leaderFailures: 0,
    waiterLatenciesMs: [],
  };
}

async function runAsLeader<TPage, THit>(
  deps: ColdMissSingleFlightDeps<TPage, THit>,
  ownerId: string,
): Promise<TPage | null> {
  const m = deps.metrics;
  try {
    if (m) m.uncachedRebuilds += 1;
    const fresh = await deps.loadUncached();
    if (fresh) {
      const persisted = await deps.persistSnapshot(fresh);
      if (persisted.ok) {
        if (m) m.persistOk += 1;
      } else {
        if (m) m.persistFail += 1;
        // Awaited persist attempt (not fire-and-forget); mark failed so waiters can recover.
        await deps.markFailed(ownerId);
        return fresh;
      }
    } else {
      await deps.markFailed(ownerId);
      return null;
    }
    await deps.release(ownerId);
    return fresh;
  } catch (err) {
    if (m) m.leaderFailures += 1;
    await deps.markFailed(ownerId);
    throw err;
  }
}

async function waitForSnapshot<TPage, THit>(
  deps: ColdMissSingleFlightDeps<TPage, THit>,
  startedAt: number,
): Promise<THit | null> {
  const m = deps.metrics;
  while (deps.now() - startedAt < deps.waiterMaxMs) {
    await deps.sleep(deps.pollMs);
    if (m) m.snapshotReads += 1;
    const hit = await deps.readSnapshot();
    if (hit && deps.isUsableHit(hit)) return hit;
  }
  return null;
}

/**
 * Cold miss: single-flight rebuild across instances.
 * Waiters never call loadUncached without winning the lease.
 */
export async function runColdMissSingleFlight<TPage, THit>(
  deps: ColdMissSingleFlightDeps<TPage, THit>,
): Promise<TPage | null> {
  const m = deps.metrics;
  const ownerId = deps.newOwnerId();

  if (m) m.leaseAcquireAttempts += 1;
  const acquired = await deps.tryAcquire(ownerId);

  // Lease infra unavailable — degrade to direct uncached (same as pre-lease behavior).
  if (acquired === null) {
    if (m) m.uncachedRebuilds += 1;
    const fresh = await deps.loadUncached();
    if (fresh) {
      const persisted = await deps.persistSnapshot(fresh);
      if (m) {
        if (persisted.ok) m.persistOk += 1;
        else m.persistFail += 1;
      }
    }
    return fresh;
  }

  if (acquired) {
    if (m) m.leaseAcquired += 1;
    return runAsLeader(deps, ownerId);
  }

  // Waiter path — no provider fan-out.
  const waitStarted = deps.now();
  const hit = await waitForSnapshot(deps, waitStarted);
  if (hit) {
    if (m) m.waiterLatenciesMs.push(deps.now() - waitStarted);
    return deps.pageFromSnapshot(hit);
  }

  if (m) m.waiterTimeouts += 1;

  // Prefer allowed stale before contending for a new lease.
  if (m) m.snapshotReads += 1;
  const stale = await deps.readSnapshot();
  if (stale && deps.isUsableHit(stale)) {
    if (m) m.waiterStaleServes += 1;
    if (m) m.waiterLatenciesMs.push(deps.now() - waitStarted);
    return deps.pageFromSnapshot(stale);
  }

  // One re-acquire attempt (recover crashed/expired leader).
  const retryOwner = deps.newOwnerId();
  if (m) m.leaseAcquireAttempts += 1;
  const retryAcquired = await deps.tryAcquire(retryOwner);
  if (retryAcquired === true) {
    if (m) m.leaseAcquired += 1;
    return runAsLeader(deps, retryOwner);
  }

  if (m) m.waiterFallbackServes += 1;
  if (m) m.waiterLatenciesMs.push(deps.now() - waitStarted);
  return deps.fallbackPage();
}

/** Equity stock SSR cold miss — thin wrapper over {@link runColdMissSingleFlight}. */
export async function runAssetColdMissSingleFlight<TPage>(
  deps: AssetColdMissSingleFlightDeps<TPage>,
): Promise<TPage | null> {
  return runColdMissSingleFlight<TPage, AssetSnapshotHit>({
    tryAcquire: deps.tryAcquire,
    release: deps.release,
    markFailed: deps.markFailed,
    newOwnerId: deps.newOwnerId,
    loadUncached: deps.loadUncached,
    persistSnapshot: deps.persistSnapshot,
    readSnapshot: deps.readSnapshot,
    isUsableHit: (hit) => hit?.payload?.ticker === deps.ticker,
    pageFromSnapshot: deps.pageFromSnapshot,
    fallbackPage: deps.fallbackPage,
    sleep: deps.sleep,
    now: deps.now,
    waiterMaxMs: deps.waiterMaxMs,
    pollMs: deps.pollMs,
    metrics: deps.metrics,
  });
}
