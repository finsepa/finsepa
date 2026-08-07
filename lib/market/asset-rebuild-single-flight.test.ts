/**
 * Concurrent cold-miss single-flight simulation.
 * Run: npx tsx --test lib/market/asset-rebuild-single-flight.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "crypto";

import {
  createAssetColdMissMetrics,
  runAssetColdMissSingleFlight,
  type AssetSnapshotHit,
} from "@/lib/market/asset-rebuild-single-flight";
import { createMemoryRebuildLeaseStore } from "@/lib/market/asset-rebuild-lease-memory";
import type { AssetSnapshotPayload } from "@/lib/market/asset-snapshot-payload";

type Page = { ticker: string; tag: string; fromUncached: boolean };

function makePayload(ticker: string): AssetSnapshotPayload {
  return {
    ticker,
    isEtf: false,
    headerMeta: {
      fullName: ticker,
      logoUrl: null,
      exchange: null,
      countryIso: null,
      sector: null,
      industry: null,
      earningsDateDisplay: null,
      watchlistCount: null,
      screenerRank: null,
    },
    chart: { range: "1D", points: [{ time: 1, value: 100 }] },
    performance: {
      price: 100,
      change1D: 1,
      change1W: null,
      change1M: null,
      change3M: null,
      change6M: null,
      changeYTD: null,
      change1Y: null,
      change3Y: null,
      change5Y: null,
      change10Y: null,
      changeAll: null,
    } as AssetSnapshotPayload["performance"],
    news: [],
    profile: null,
    fundamentalsSeriesAnnual: [],
    fundamentalsSeriesQuarterly: [],
    fundamentalsTtmPoint: null,
    peersCompareRows: [],
    liveRegularSessionActive: false,
    earningsTabPayload: null,
    keyStatsBundle: {
      basic: null,
      valuation: null,
      revenueProfit: null,
      margins: null,
      growth: null,
      assetsLiabilities: null,
      returns: null,
      dividends: null,
      risk: null,
    },
    headerLiveSpotUsd: null,
    headerPriorCloseUsd: null,
  };
}

async function simulateConcurrentColdOpens(opts: {
  concurrency: number;
  ticker: string;
  segment: string;
  rebuildMs?: number;
  eodhdPerRebuild?: number;
  priorStale?: boolean;
  leaderCrash?: boolean;
}) {
  const {
    concurrency,
    ticker,
    segment,
    rebuildMs = 80,
    eodhdPerRebuild = 11,
    priorStale = false,
    leaderCrash = false,
  } = opts;

  // Wall clock for waiter timeouts (shared fake clock would race under concurrency).
  const leaseClock = { now: () => Date.now() };
  const lease = createMemoryRebuildLeaseStore(leaseClock);
  const snapshots = new Map<string, AssetSnapshotHit>();
  const snapKey = `asset_${ticker}`;

  if (priorStale) {
    snapshots.set(snapKey, {
      payload: makePayload(ticker),
      exactSegment: false,
    });
  }

  const metrics = createAssetColdMissMetrics();
  let persistBeforeReleaseOk = true;
  let leaseHeldDuringPersist = false;
  let dbCalls = 0;

  const runOne = () =>
    runAssetColdMissSingleFlight<Page>({
      snapshotKey: snapKey,
      ticker,
      segment,
      mode: "live",
      tryAcquire: async (ownerId) => {
        dbCalls += 1;
        return lease.tryAcquire(snapKey, segment, ownerId, 60);
      },
      release: async (ownerId) => {
        dbCalls += 1;
        const row = lease.rows.get(`${snapKey}\0${segment}`);
        if (row && row.ownerId === ownerId && !snapshots.has(snapKey) && !leaderCrash) {
          persistBeforeReleaseOk = false;
        }
        lease.release(snapKey, segment, ownerId);
      },
      markFailed: async (ownerId) => {
        dbCalls += 1;
        lease.fail(snapKey, segment, ownerId);
      },
      newOwnerId: () => randomUUID(),
      loadUncached: async () => {
        metrics.eodhdCalls += eodhdPerRebuild;
        await new Promise((r) => setTimeout(r, rebuildMs));
        if (leaderCrash) throw new Error("simulated leader crash");
        return { ticker, tag: "fresh", fromUncached: true };
      },
      persistSnapshot: async (page) => {
        dbCalls += 1;
        const row = lease.rows.get(`${snapKey}\0${segment}`);
        leaseHeldDuringPersist = !!(row && row.status === "building");
        snapshots.set(snapKey, {
          payload: makePayload(page.ticker),
          exactSegment: true,
        });
        return { ok: true };
      },
      readSnapshot: async () => {
        dbCalls += 1;
        return snapshots.get(snapKey) ?? null;
      },
      pageFromSnapshot: async (hit) => ({
        ticker: hit.payload.ticker,
        tag: "snapshot",
        fromUncached: false,
      }),
      fallbackPage: () => ({ ticker, tag: "fallback", fromUncached: false }),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      waiterMaxMs: 2_000,
      pollMs: 20,
      metrics,
    });

  const results = await Promise.all(Array.from({ length: concurrency }, () => runOne()));
  return {
    results,
    metrics,
    persistBeforeReleaseOk,
    leaseHeldDuringPersist,
    snapshots,
    lease,
    dbCalls,
  };
}

describe("asset cold-miss single-flight", () => {
  it("10 simultaneous cold opens → exactly 1 uncached rebuild, waiters 0 EODHD", async () => {
    const { results, metrics, persistBeforeReleaseOk, leaseHeldDuringPersist, dbCalls } =
      await simulateConcurrentColdOpens({
        concurrency: 10,
        ticker: "NVDA",
        segment: "live-test-seg",
      });

    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(metrics.eodhdCalls, 11);
    assert.equal(metrics.leaseAcquired, 1);
    assert.ok(persistBeforeReleaseOk, "snapshot must exist before lease release");
    assert.ok(leaseHeldDuringPersist, "lease must be held during persist");
    assert.ok(results.every((r) => r && r.ticker === "NVDA"));
    const fromUncached = results.filter((r) => r?.fromUncached).length;
    assert.equal(fromUncached, 1);
    const waiters = results.filter((r) => r && !r.fromUncached);
    assert.equal(waiters.length, 9);
    assert.ok(waiters.every((r) => r?.tag === "snapshot"));
    assert.equal(metrics.waiterTimeouts, 0);
    assert.equal(metrics.waiterFallbackServes, 0);
    assert.ok(metrics.waiterLatenciesMs.length >= 1);
    const avgWait =
      metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length;
    console.log(
      JSON.stringify({
        case: "10-concurrent",
        uncachedRebuilds: metrics.uncachedRebuilds,
        eodhdCalls: metrics.eodhdCalls,
        dbCalls,
        leaseAcquireAttempts: metrics.leaseAcquireAttempts,
        waiterCount: waiters.length,
        avgWaiterLatencyMs: Math.round(avgWait),
        maxWaiterLatencyMs: Math.max(...metrics.waiterLatenciesMs),
        timeouts: metrics.waiterTimeouts,
        fallbacks: metrics.waiterFallbackServes,
      }),
    );
  });

  it("100 simultaneous cold opens → exactly 1 uncached rebuild", async () => {
    const { metrics, results, dbCalls } = await simulateConcurrentColdOpens({
      concurrency: 100,
      ticker: "NVDA",
      segment: "live-test-seg-100",
      rebuildMs: 120,
    });

    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(metrics.eodhdCalls, 11);
    assert.equal(results.filter((r) => r?.fromUncached).length, 1);
    assert.equal(results.filter((r) => r && !r.fromUncached).length, 99);
    assert.equal(metrics.waiterTimeouts, 0);
    assert.equal(metrics.waiterFallbackServes, 0);
    const avgWait =
      metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length;
    console.log(
      JSON.stringify({
        case: "100-concurrent",
        uncachedRebuilds: metrics.uncachedRebuilds,
        eodhdCalls: metrics.eodhdCalls,
        dbCalls,
        leaseAcquireAttempts: metrics.leaseAcquireAttempts,
        waiterCount: 99,
        avgWaiterLatencyMs: Math.round(avgWait),
        maxWaiterLatencyMs: Math.max(...metrics.waiterLatenciesMs),
        timeouts: metrics.waiterTimeouts,
        fallbacks: metrics.waiterFallbackServes,
      }),
    );
  });

  it("different tickers rebuild concurrently", async () => {
    const a = simulateConcurrentColdOpens({
      concurrency: 5,
      ticker: "AAPL",
      segment: "seg",
      rebuildMs: 50,
    });
    const b = simulateConcurrentColdOpens({
      concurrency: 5,
      ticker: "MSFT",
      segment: "seg",
      rebuildMs: 50,
    });
    const [ra, rb] = await Promise.all([a, b]);
    assert.equal(ra.metrics.uncachedRebuilds, 1);
    assert.equal(rb.metrics.uncachedRebuilds, 1);
    assert.equal(ra.metrics.eodhdCalls + rb.metrics.eodhdCalls, 22);
    console.log(
      JSON.stringify({
        case: "different-tickers",
        uncachedRebuilds: ra.metrics.uncachedRebuilds + rb.metrics.uncachedRebuilds,
        eodhdCalls: ra.metrics.eodhdCalls + rb.metrics.eodhdCalls,
      }),
    );
  });

  it("leader failure preserves old snapshot and waiters use stale without uncached", async () => {
    const oldPayload = makePayload("NFLX");
    const leaseClock = { now: () => Date.now() };
    const lease = createMemoryRebuildLeaseStore(leaseClock);
    const snapshots = new Map<string, AssetSnapshotHit>([
      ["asset_NFLX", { payload: oldPayload, exactSegment: false }],
    ]);
    const metrics = createAssetColdMissMetrics();
    const snapKey = "asset_NFLX";
    const segment = "seg-fail";

    const runOne = () =>
      runAssetColdMissSingleFlight<Page>({
        snapshotKey: snapKey,
        ticker: "NFLX",
        segment,
        mode: "live",
        tryAcquire: async (ownerId) => lease.tryAcquire(snapKey, segment, ownerId, 60),
        release: async (ownerId) => lease.release(snapKey, segment, ownerId),
        markFailed: async (ownerId) => lease.fail(snapKey, segment, ownerId),
        newOwnerId: () => randomUUID(),
        loadUncached: async () => {
          metrics.eodhdCalls += 11;
          await new Promise((r) => setTimeout(r, 40));
          throw new Error("boom");
        },
        persistSnapshot: async () => {
          throw new Error("should not persist");
        },
        readSnapshot: async () => snapshots.get(snapKey) ?? null,
        pageFromSnapshot: async (hit) => ({
          ticker: hit.payload.ticker,
          tag: "stale",
          fromUncached: false,
        }),
        fallbackPage: () => ({ ticker: "NFLX", tag: "fallback", fromUncached: false }),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        now: () => Date.now(),
        waiterMaxMs: 500,
        pollMs: 15,
        metrics,
      });

    const settled = await Promise.allSettled([runOne(), runOne(), runOne()]);
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(metrics.eodhdCalls, 11);
    assert.ok(snapshots.get(snapKey)?.payload === oldPayload);
    const rejected = settled.filter((s) => s.status === "rejected");
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    assert.equal(rejected.length, 1);
    assert.ok(fulfilled.length >= 2);
    assert.ok(
      fulfilled.every(
        (s) =>
          s.status === "fulfilled" &&
          s.value &&
          !s.value.fromUncached &&
          s.value.tag === "stale",
      ),
    );
    console.log(
      JSON.stringify({
        case: "leader-failure-stale",
        uncachedRebuilds: metrics.uncachedRebuilds,
        eodhdCalls: metrics.eodhdCalls,
        staleServes: metrics.waiterStaleServes + fulfilled.length,
        preservedOldSnapshot: true,
      }),
    );
  });

  it("expired leader lease can be acquired by a new owner", async () => {
    let nowMs = 3_000_000;
    const clock = { now: () => nowMs };
    const lease = createMemoryRebuildLeaseStore(clock);
    const key = "asset_AMD";
    const segment = "seg";
    const first = randomUUID();
    assert.equal(lease.tryAcquire(key, segment, first, 1), true);
    nowMs += 2_000; // expire
    const second = randomUUID();
    assert.equal(lease.tryAcquire(key, segment, second, 60), true);
    assert.equal(lease.rows.get(`${key}\0${segment}`)?.ownerId, second);
  });

  it("crashed leader recovery: waiter re-acquires after timeout when no snapshot", async () => {
    let leaseTtlMs = 50;
    const leaseClock = { now: () => Date.now() };
    const lease = createMemoryRebuildLeaseStore(leaseClock);
    const snapshots = new Map<string, AssetSnapshotHit>();
    const metrics = createAssetColdMissMetrics();
    const snapKey = "asset_CRASH";
    const segment = "seg";
    let rebuilds = 0;

    // First leader acquires then "crashes" without release/fail (simulate process death).
    const crashOwner = randomUUID();
    assert.equal(lease.tryAcquire(snapKey, segment, crashOwner, 1), true);
    // Expire lease via TTL (memory store uses seconds; ttl=1 → 1000ms).
    await new Promise((r) => setTimeout(r, 1100));

    const page = await runAssetColdMissSingleFlight<Page>({
      snapshotKey: snapKey,
      ticker: "CRASH",
      segment,
      mode: "live",
      tryAcquire: async (ownerId) => lease.tryAcquire(snapKey, segment, ownerId, 60),
      release: async (ownerId) => lease.release(snapKey, segment, ownerId),
      markFailed: async (ownerId) => lease.fail(snapKey, segment, ownerId),
      newOwnerId: () => randomUUID(),
      loadUncached: async () => {
        rebuilds += 1;
        metrics.eodhdCalls += 11;
        return { ticker: "CRASH", tag: "recovered", fromUncached: true };
      },
      persistSnapshot: async (page) => {
        snapshots.set(snapKey, { payload: makePayload(page.ticker), exactSegment: true });
        return { ok: true };
      },
      readSnapshot: async () => snapshots.get(snapKey) ?? null,
      pageFromSnapshot: async (hit) => ({
        ticker: hit.payload.ticker,
        tag: "snapshot",
        fromUncached: false,
      }),
      fallbackPage: () => ({ ticker: "CRASH", tag: "fallback", fromUncached: false }),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      waiterMaxMs: 200,
      pollMs: 20,
      metrics,
    });

    assert.equal(page?.tag, "recovered");
    assert.equal(rebuilds, 1);
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.ok(snapshots.has(snapKey));
    void leaseTtlMs;
  });
});
