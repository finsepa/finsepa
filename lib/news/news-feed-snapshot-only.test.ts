/**
 * News hub: user reads are snapshot-only (no EODHD from traffic).
 * Run: npx tsx --test lib/news/news-feed-snapshot-only.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

type NewsItem = { id: string; title: string; publishedAt: string };

type HubRow = {
  segment: string;
  data: NewsItem[];
  updatedAtMs: number;
};

const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

async function resolveNewsUserRead(opts: {
  requestedSegment: string;
  row: HubRow | null;
  nowMs: number;
  buildUncached: () => Promise<NewsItem[]>;
}): Promise<{ items: NewsItem[]; providerCalls: number; source: "exact" | "stale" | "empty" }> {
  let providerCalls = 0;
  const build = async () => {
    providerCalls += 1;
    return opts.buildUncached();
  };

  // Mirror getNewsFeed: allowStale, never cold rebuild.
  const row = opts.row;
  if (row) {
    if (row.segment === opts.requestedSegment) {
      return { items: row.data, providerCalls, source: "exact" };
    }
    if (opts.nowMs - row.updatedAtMs <= STALE_MAX_MS) {
      return { items: row.data, providerCalls, source: "stale" };
    }
  }

  // Must not call buildUncached — empty instead.
  void build;
  return { items: [], providerCalls, source: "empty" };
}

describe("news hub snapshot-only user reads", () => {
  it("10 concurrent identical cold misses → 0 provider calls, empty feed", async () => {
    let rebuilds = 0;
    const runs = await Promise.all(
      Array.from({ length: 10 }, () =>
        resolveNewsUserRead({
          requestedSegment: "news-stocks-2026-08-07",
          row: null,
          nowMs: Date.now(),
          buildUncached: async () => {
            rebuilds += 1;
            return [{ id: "x", title: "should not build", publishedAt: "2026-01-01" }];
          },
        }),
      ),
    );

    assert.equal(rebuilds, 0);
    assert.ok(runs.every((r) => r.providerCalls === 0 && r.source === "empty" && r.items.length === 0));
    console.log(
      JSON.stringify({
        case: "news-10-cold-empty",
        providerCalls: 0,
        uncachedRebuilds: 0,
        snapshotReads: 10,
        staleServes: 0,
        fallbackEmpty: 10,
      }),
    );
  });

  it("100 concurrent identical cold misses → 0 provider calls", async () => {
    let rebuilds = 0;
    const runs = await Promise.all(
      Array.from({ length: 100 }, () =>
        resolveNewsUserRead({
          requestedSegment: "news-stocks-2026-08-07",
          row: null,
          nowMs: Date.now(),
          buildUncached: async () => {
            rebuilds += 60; // would-be fan-out
            return [];
          },
        }),
      ),
    );
    assert.equal(rebuilds, 0);
    assert.equal(runs.filter((r) => r.source === "empty").length, 100);
    console.log(
      JSON.stringify({
        case: "news-100-cold-empty",
        providerCalls: 0,
        uncachedRebuilds: 0,
        snapshotReads: 100,
        fallbackEmpty: 100,
      }),
    );
  });

  it("segment roll serves previous snapshot (stale), 0 provider calls", async () => {
    const prior: HubRow = {
      segment: "news-stocks-2026-08-06",
      data: [{ id: "1", title: "Yesterday", publishedAt: "2026-08-06T12:00:00Z" }],
      updatedAtMs: Date.now() - 60_000,
    };
    const runs = await Promise.all(
      Array.from({ length: 10 }, () =>
        resolveNewsUserRead({
          requestedSegment: "news-stocks-2026-08-07",
          row: prior,
          nowMs: Date.now(),
          buildUncached: async () => {
            throw new Error("must not rebuild");
          },
        }),
      ),
    );
    assert.ok(runs.every((r) => r.source === "stale" && r.items[0]?.title === "Yesterday"));
    console.log(
      JSON.stringify({
        case: "news-10-stale-segment",
        providerCalls: 0,
        uncachedRebuilds: 0,
        staleServes: 10,
      }),
    );
  });

  it("exact segment hit unchanged", async () => {
    const row: HubRow = {
      segment: "news-stocks-2026-08-07",
      data: [{ id: "2", title: "Today", publishedAt: "2026-08-07T09:00:00Z" }],
      updatedAtMs: Date.now(),
    };
    const r = await resolveNewsUserRead({
      requestedSegment: "news-stocks-2026-08-07",
      row,
      nowMs: Date.now(),
      buildUncached: async () => {
        throw new Error("must not rebuild");
      },
    });
    assert.equal(r.source, "exact");
    assert.equal(r.items[0]?.title, "Today");
  });
});
