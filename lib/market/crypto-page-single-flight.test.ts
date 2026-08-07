/**
 * Crypto page cold-miss single-flight (routeSymbol identity).
 * Run: npx tsx --test lib/market/crypto-page-single-flight.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "crypto";

import {
  createAssetColdMissMetrics,
  runColdMissSingleFlight,
} from "@/lib/market/asset-rebuild-single-flight";
import { createMemoryRebuildLeaseStore } from "@/lib/market/asset-rebuild-lease-memory";

type Page = { routeSymbol: string; tag: string; fromUncached: boolean };
type Hit = { payload: { routeSymbol: string }; exactSegment: boolean };

async function simulateCryptoCold(concurrency: number, symbol: string) {
  const key = `asset_crypto_${symbol}`;
  const segment = "crypto_page_v1:1";
  const lease = createMemoryRebuildLeaseStore({ now: () => Date.now() });
  const snapshots = new Map<string, Hit>();
  const metrics = createAssetColdMissMetrics();
  let providerCalls = 0;
  let persistBeforeRelease = true;
  let dbCalls = 0;

  const runOne = () =>
    runColdMissSingleFlight<Page, Hit>({
      tryAcquire: async (ownerId) => {
        dbCalls += 1;
        return lease.tryAcquire(key, segment, ownerId, 60);
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
        providerCalls += 3;
        metrics.eodhdCalls += 3;
        await new Promise((r) => setTimeout(r, 60));
        return { routeSymbol: symbol, tag: "fresh", fromUncached: true };
      },
      persistSnapshot: async (page) => {
        dbCalls += 1;
        snapshots.set(key, {
          payload: { routeSymbol: page.routeSymbol },
          exactSegment: true,
        });
        return { ok: true };
      },
      readSnapshot: async () => {
        dbCalls += 1;
        return snapshots.get(key) ?? null;
      },
      isUsableHit: (hit) => hit?.payload?.routeSymbol === symbol,
      pageFromSnapshot: async (hit) => ({
        routeSymbol: hit.payload.routeSymbol,
        tag: "snapshot",
        fromUncached: false,
      }),
      fallbackPage: () => ({ routeSymbol: symbol, tag: "empty", fromUncached: false }),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      waiterMaxMs: 2_000,
      pollMs: 20,
      metrics,
    });

  const results = await Promise.all(Array.from({ length: concurrency }, () => runOne()));
  return { results, metrics, providerCalls, persistBeforeRelease, dbCalls };
}

describe("crypto page single-flight", () => {
  it("10 concurrent BTC cold → 1 rebuild, waiters 0 provider", async () => {
    const { metrics, providerCalls, persistBeforeRelease, results, dbCalls } =
      await simulateCryptoCold(10, "BTC");
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 3);
    assert.ok(persistBeforeRelease);
    assert.equal(results.filter((r) => r?.fromUncached).length, 1);
    assert.equal(results.filter((r) => r && !r.fromUncached).length, 9);
    console.log(
      JSON.stringify({
        case: "crypto-10",
        providerCalls,
        uncachedRebuilds: 1,
        dbCalls,
        avgWaiterLatencyMs: Math.round(
          metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
        ),
        timeouts: metrics.waiterTimeouts,
        fallbacks: metrics.waiterFallbackServes,
      }),
    );
  });

  it("100 concurrent BTC cold → 1 rebuild", async () => {
    const { metrics, providerCalls, results } = await simulateCryptoCold(100, "BTC");
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 3);
    assert.equal(results.filter((r) => r?.fromUncached).length, 1);
    console.log(
      JSON.stringify({
        case: "crypto-100",
        providerCalls,
        uncachedRebuilds: 1,
        avgWaiterLatencyMs: Math.round(
          metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
        ),
        timeouts: metrics.waiterTimeouts,
      }),
    );
  });
});
