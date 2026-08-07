/**
 * Index / currency page single-flight verification.
 * Run: npx tsx --test lib/market/route-asset-page-single-flight.test.ts
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

async function simulate(kind: "index" | "currency", concurrency: number, symbol: string, providerPer = 2) {
  const key = kind === "index" ? `asset_index_${symbol}` : `asset_currency_${symbol}`;
  const segment = `${kind}_page_v1:1`;
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
        providerCalls += providerPer;
        await new Promise((r) => setTimeout(r, 40));
        return { routeSymbol: symbol, tag: "fresh", fromUncached: true };
      },
      persistSnapshot: async (page) => {
        dbCalls += 1;
        snapshots.set(key, { payload: { routeSymbol: page.routeSymbol }, exactSegment: true });
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
      pollMs: 15,
      metrics,
    });

  const results = await Promise.all(Array.from({ length: concurrency }, () => runOne()));
  return { results, metrics, providerCalls, persistBeforeRelease, dbCalls };
}

describe("index / currency page single-flight", () => {
  it("index 10 concurrent → 1 rebuild", async () => {
    const { metrics, providerCalls, persistBeforeRelease, results, dbCalls } = await simulate(
      "index",
      10,
      "GSPC.INDX",
      2,
    );
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 2);
    assert.ok(persistBeforeRelease);
    assert.equal(results.filter((r) => r?.fromUncached).length, 1);
    console.log(
      JSON.stringify({
        case: "index-10",
        providerCalls,
        uncachedRebuilds: 1,
        dbCalls,
        avgWaiterLatencyMs: Math.round(
          metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
        ),
        timeouts: metrics.waiterTimeouts,
      }),
    );
  });

  it("index 100 concurrent → 1 rebuild", async () => {
    const { metrics, providerCalls } = await simulate("index", 100, "GSPC.INDX", 2);
    assert.equal(metrics.uncachedRebuilds, 1);
    assert.equal(providerCalls, 2);
    console.log(
      JSON.stringify({
        case: "index-100",
        providerCalls,
        uncachedRebuilds: 1,
        avgWaiterLatencyMs: Math.round(
          metrics.waiterLatenciesMs.reduce((a, b) => a + b, 0) / metrics.waiterLatenciesMs.length,
        ),
      }),
    );
  });

  it("currency 10 + 100 concurrent → 1 rebuild each", async () => {
    const a = await simulate("currency", 10, "EURUSD.FOREX", 1);
    const b = await simulate("currency", 100, "EURUSD.FOREX", 1);
    assert.equal(a.metrics.uncachedRebuilds, 1);
    assert.equal(a.providerCalls, 1);
    assert.equal(b.metrics.uncachedRebuilds, 1);
    assert.equal(b.providerCalls, 1);
    console.log(
      JSON.stringify({
        case: "currency-10-and-100",
        providerCalls10: a.providerCalls,
        providerCalls100: b.providerCalls,
        uncachedRebuilds: 1,
        avgWaiterLatencyMs100: Math.round(
          b.metrics.waiterLatenciesMs.reduce((x, y) => x + y, 0) / b.metrics.waiterLatenciesMs.length,
        ),
      }),
    );
  });
});
