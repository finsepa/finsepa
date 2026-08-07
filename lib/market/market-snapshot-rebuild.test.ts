/**
 * Market aggregate blob single-flight simulation (screener / heatmap cold miss).
 * Run: npx tsx --test lib/market/market-snapshot-rebuild.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "crypto";

import {
  createAssetColdMissMetrics,
  runColdMissSingleFlight,
} from "@/lib/market/asset-rebuild-single-flight";
import { createMemoryRebuildLeaseStore } from "@/lib/market/asset-rebuild-lease-memory";

type Blob = { tag: string; n: number };

async function simulateBlobCold(opts: {
  concurrency: number;
  key: string;
  segment: string;
  rebuildMs?: number;
  providerCallsPerRebuild?: number;
  priorStale?: Blob | null;
}) {
  const {
    concurrency,
    key,
    segment,
    rebuildMs = 80,
    providerCallsPerRebuild = 30,
    priorStale = null,
  } = opts;

  const lease = createMemoryRebuildLeaseStore({ now: () => Date.now() });
  const snapshots = new Map<string, Blob>();
  if (priorStale) snapshots.set(key, priorStale);

  const metrics = createAssetColdMissMetrics();
  let providerCalls = 0;
  let dbCalls = 0;
  let persistBeforeRelease = true;

  const runOne = () =>
    runColdMissSingleFlight<Blob, { payload: Blob }>({
      tryAcquire: async (ownerId) => {
        dbCalls += 1;
        return lease.tryAcquire(key, segment, ownerId, 180);
      },
      release: async (ownerId) => {
        dbCalls += 1;
        if (!snapshots.has(key)) persistBeforeRelease = false;
        lease.release(key, segment, ownerId);
      },
      markFailed: async (ownerId) => {
        dbCalls += 1;
        lease.fail(key, segment, ownerId);
      },
      newOwnerId: () => randomUUID(),
      loadUncached: async () => {
        metrics.eodhdCalls += providerCallsPerRebuild;
        providerCalls += providerCallsPerRebuild;
        await new Promise((r) => setTimeout(r, rebuildMs));
        return { tag: "fresh", n: providerCallsPerRebuild };
      },
      persistSnapshot: async (page) => {
        dbCalls += 1;
        snapshots.set(key, page);
        return { ok: true };
      },
      readSnapshot: async () => {
        dbCalls += 1;
        const p = snapshots.get(key);
        return p ? { payload: p } : null;
      },
      isUsableHit: (hit) => !!hit?.payload,
      pageFromSnapshot: async (hit) => hit.payload,
      fallbackPage: () => ({ tag: "empty", n: 0 }),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      waiterMaxMs: 2_000,
      pollMs: 20,
      metrics,
    });

  const results = await Promise.all(Array.from({ length: concurrency }, () => runOne()));
  return { results, metrics, providerCalls, dbCalls, persistBeforeRelease, snapshots };
}

describe("market snapshot blob single-flight", () => {
  it("10 concurrent stocks_all_pages cold → 1 rebuild", async () => {
    const { metrics, providerCalls, persistBeforeRelease, results, dbCalls } = await simulateBlobCold({
      concurrency: 10,
      key: "stocks_all_pages",
      segment: "live-test",
      providerCallsPerRebuild: 30,
    });
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 30);
    assert.ok(persistBeforeRelease);
    assert.equal(results.length, 10);
    assert.ok(results.every((r) => r && r.n === 30 && r.tag === "fresh"));
    assert.equal(metrics.leaseAcquired, 1);
    const avg =
      metrics.waiterLatenciesMs.length > 0
        ? Math.round(
            metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
          )
        : 0;
    console.log(
      JSON.stringify({
        case: "screener-10-stocks-blob",
        providerCalls,
        uncachedRebuilds: metrics.uncachedRebuilds,
        dbCalls,
        avgWaiterLatencyMs: avg,
        maxWaiterLatencyMs: metrics.waiterLatenciesMs.length
          ? Math.max(...metrics.waiterLatenciesMs)
          : 0,
        timeouts: metrics.waiterTimeouts,
        fallbacks: metrics.waiterFallbackServes,
        waiterLatencies: metrics.waiterLatenciesMs.length,
      }),
    );
  });

  it("100 concurrent identical cold → 1 rebuild", async () => {
    const { metrics, providerCalls, results } = await simulateBlobCold({
      concurrency: 100,
      key: "stocks_all_pages",
      segment: "live-test-100",
      rebuildMs: 120,
      providerCallsPerRebuild: 30,
    });
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 30);
    assert.equal(results.filter((r) => r?.tag === "fresh").length >= 1, true);
    assert.equal(metrics.waiterTimeouts, 0);
    console.log(
      JSON.stringify({
        case: "screener-100-stocks-blob",
        providerCalls,
        uncachedRebuilds: metrics.uncachedRebuilds,
        waiterCount: results.filter((r) => !r?.tag || true).length - 1,
        avgWaiterLatencyMs: metrics.waiterLatenciesMs.length
          ? Math.round(
              metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
            )
          : 0,
        timeouts: metrics.waiterTimeouts,
        fallbacks: metrics.waiterFallbackServes,
      }),
    );
  });

  it("leader failure preserves prior stale snapshot for waiters", async () => {
    const key = "crypto_tab";
    const segment = "seg";
    const lease = createMemoryRebuildLeaseStore({ now: () => Date.now() });
    const snapshots = new Map<string, Blob>([[key, { tag: "stale", n: 1 }]]);
    const metrics = createAssetColdMissMetrics();
    let providerCalls = 0;

    const runOne = () =>
      runColdMissSingleFlight<Blob, { payload: Blob }>({
        tryAcquire: async (ownerId) => lease.tryAcquire(key, segment, ownerId, 60),
        release: async (ownerId) => lease.release(key, segment, ownerId),
        markFailed: async (ownerId) => lease.fail(key, segment, ownerId),
        newOwnerId: () => randomUUID(),
        loadUncached: async () => {
          providerCalls += 10;
          throw new Error("boom");
        },
        persistSnapshot: async () => ({ ok: false, reason: "no" }),
        readSnapshot: async () => {
          const p = snapshots.get(key);
          return p ? { payload: p } : null;
        },
        isUsableHit: (hit) => !!hit?.payload,
        pageFromSnapshot: async (hit) => hit.payload,
        fallbackPage: () => ({ tag: "empty", n: 0 }),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        now: () => Date.now(),
        waiterMaxMs: 200,
        pollMs: 15,
        metrics,
      });

    const settled = await Promise.allSettled([runOne(), runOne(), runOne()]);
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 10);
    assert.equal(snapshots.get(key)?.tag, "stale");
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    assert.ok(fulfilled.length >= 2);
    assert.ok(
      fulfilled.every((s) => s.status === "fulfilled" && s.value?.tag === "stale"),
    );
    console.log(
      JSON.stringify({
        case: "screener-leader-fail-stale",
        providerCalls,
        uncachedRebuilds: 1,
        stalePreserved: true,
      }),
    );
  });
});
