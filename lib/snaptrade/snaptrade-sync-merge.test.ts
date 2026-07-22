/**
 * Phase 5B — safe merge invariants. These encode the non-negotiable guarantees:
 * manual rows are never deleted, broker rows upsert by externalId, no cross-source dedupe.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import { mergeSnaptradeSyncSafe } from "./snaptrade-sync-merge.ts";

function manual(id: string, date: string, symbol: string, over: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "trade",
    operation: "Buy",
    symbol,
    name: symbol,
    logoUrl: null,
    date,
    shares: 1,
    price: 100,
    fee: 0,
    sum: -100,
    profitPct: null,
    profitUsd: null,
    source: "MANUAL",
    ...over,
  };
}

function broker(
  id: string,
  date: string,
  symbol: string,
  externalId: string | undefined,
  over: Partial<PortfolioTransaction> = {},
): PortfolioTransaction {
  return {
    id,
    portfolioId: "p1",
    kind: "trade",
    operation: "Buy",
    symbol,
    name: symbol,
    logoUrl: null,
    date,
    shares: 2,
    price: 50,
    fee: 0,
    sum: -100,
    profitPct: null,
    profitUsd: null,
    source: "SNAPTRADE",
    provider: "SNAPTRADE",
    externalId,
    ...over,
  };
}

describe("mergeSnaptradeSyncSafe — manual preservation", () => {
  it("never deletes manual rows on a full sync (updateFromYmd null)", () => {
    const existing = [manual("m1", "2024-01-01", "AAPL"), manual("m2", "2024-02-01", "MSFT")];
    const incoming = [broker("b1", "2024-03-01", "TSLA", "snaptrade:activity:a:1")];
    const { transactions, stats } = mergeSnaptradeSyncSafe({ existing, incoming, updateFromYmd: null });

    assert.equal(stats.manualPreserved, 2);
    assert.ok(transactions.find((t) => t.id === "m1"));
    assert.ok(transactions.find((t) => t.id === "m2"));
    assert.ok(transactions.find((t) => t.externalId === "snaptrade:activity:a:1"));
  });

  it("preserves manual rows even when incoming is empty", () => {
    const existing = [manual("m1", "2024-01-01", "AAPL")];
    const { transactions } = mergeSnaptradeSyncSafe({ existing, incoming: [], updateFromYmd: null });
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0]!.id, "m1");
  });

  it("treats a row with missing source as MANUAL and preserves it", () => {
    const legacyManual = manual("m1", "2024-01-01", "AAPL", { source: undefined });
    const { transactions, stats } = mergeSnaptradeSyncSafe({
      existing: [legacyManual],
      incoming: [],
      updateFromYmd: null,
    });
    assert.equal(stats.manualPreserved, 1);
    assert.equal(transactions[0]!.id, "m1");
  });

  it("NEVER cross-source dedupes: a manual row identical in content to a broker row survives", () => {
    // Manual and broker rows share date/operation/symbol/shares/price.
    const existing = [manual("m1", "2024-01-01", "AAPL", { shares: 2, price: 50 })];
    const incoming = [broker("b1", "2024-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 2, price: 50 })];
    const { transactions } = mergeSnaptradeSyncSafe({ existing, incoming, updateFromYmd: null });
    assert.ok(transactions.find((t) => t.id === "m1"), "manual row must not be dropped");
    assert.ok(transactions.find((t) => t.externalId === "snaptrade:activity:a:1"), "broker row inserted");
    assert.equal(transactions.length, 2);
  });
});

describe("mergeSnaptradeSyncSafe — broker upsert", () => {
  it("upserts by externalId, keeping the existing local id", () => {
    const existing = [broker("b-old", "2024-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 1, price: 10 })];
    const incoming = [broker("b-new", "2024-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 3, price: 12 })];
    const { transactions, stats } = mergeSnaptradeSyncSafe({ existing, incoming, updateFromYmd: null });

    assert.equal(stats.brokerUpdated, 1);
    assert.equal(stats.brokerInserted, 0);
    assert.equal(transactions.length, 1);
    const row = transactions[0]!;
    assert.equal(row.id, "b-old", "identity preserved");
    assert.equal(row.shares, 3, "fields refreshed from incoming");
    assert.equal(row.price, 12);
  });

  it("preserves existing broker rows that are NOT in the incoming draft (incremental)", () => {
    const existing = [broker("b1", "2024-01-01", "AAPL", "snaptrade:activity:a:1")];
    const incoming = [broker("b2", "2024-02-01", "MSFT", "snaptrade:activity:a:2")];
    const { transactions, stats } = mergeSnaptradeSyncSafe({ existing, incoming, updateFromYmd: null });

    assert.equal(stats.brokerPreserved, 1);
    assert.equal(stats.brokerInserted, 1);
    assert.ok(transactions.find((t) => t.externalId === "snaptrade:activity:a:1"));
    assert.ok(transactions.find((t) => t.externalId === "snaptrade:activity:a:2"));
  });

  it("full-history replace drops broker rows missing from incoming (keeps manual)", () => {
    const existing = [
      manual("m1", "2024-01-01", "CASH"),
      broker("b1", "2024-01-01", "AAPL", "snaptrade:activity:a:1"),
      broker("b-junk", "2024-06-01", "META", "snaptrade:order:junk:1"),
    ];
    const incoming = [broker("b2", "2024-02-01", "MSFT", "snaptrade:activity:a:2")];
    const { transactions, stats } = mergeSnaptradeSyncSafe({
      existing,
      incoming,
      updateFromYmd: null,
      replaceMissingBrokerRows: true,
    });

    assert.equal(stats.brokerDropped, 2);
    assert.equal(stats.manualPreserved, 1);
    assert.ok(transactions.find((t) => t.id === "m1"));
    assert.ok(transactions.find((t) => t.externalId === "snaptrade:activity:a:2"));
    assert.equal(transactions.find((t) => t.externalId === "snaptrade:activity:a:1"), undefined);
    assert.equal(transactions.find((t) => t.externalId === "snaptrade:order:junk:1"), undefined);
  });

  it("matches legacy broker rows (no externalId) within-source via content fallback", () => {
    const legacy = broker("b-legacy", "2024-01-01", "AAPL", undefined, { shares: 2, price: 50, sum: -100 });
    const incoming = [broker("b-new", "2024-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 2, price: 50, sum: -100 })];
    const { transactions, stats } = mergeSnaptradeSyncSafe({ existing: [legacy], incoming, updateFromYmd: null });

    assert.equal(stats.brokerUpdated, 1, "legacy row matched, not duplicated");
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0]!.id, "b-legacy", "keeps legacy id");
    assert.equal(transactions[0]!.externalId, "snaptrade:activity:a:1", "gains a stable externalId");
  });
});

describe("mergeSnaptradeSyncSafe — updateFromYmd window", () => {
  it("does not refresh broker rows older than the update window (but keeps them)", () => {
    const existing = [broker("b-old", "2023-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 1 })];
    // Server should not have returned this old row, but if it does, we must not rewrite it.
    const incoming = [broker("b-new", "2023-01-01", "AAPL", "snaptrade:activity:a:1", { shares: 999 })];
    const { transactions, stats } = mergeSnaptradeSyncSafe({
      existing,
      incoming,
      updateFromYmd: "2024-01-01",
    });

    assert.equal(stats.brokerSkippedOutsideWindow, 1);
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0]!.shares, 1, "old row not refreshed outside window");
  });

  it("refreshes broker rows inside the window", () => {
    const existing = [broker("b-old", "2024-06-01", "AAPL", "snaptrade:activity:a:1", { shares: 1 })];
    const incoming = [broker("b-new", "2024-06-01", "AAPL", "snaptrade:activity:a:1", { shares: 5 })];
    const { transactions, stats } = mergeSnaptradeSyncSafe({
      existing,
      incoming,
      updateFromYmd: "2024-01-01",
    });
    assert.equal(stats.brokerUpdated, 1);
    assert.equal(transactions[0]!.shares, 5);
  });
});

describe("mergeSnaptradeSyncSafe — ordering", () => {
  it("sorts by date then kind (cash → trade → other)", () => {
    const existing = [
      manual("m-trade", "2024-01-01", "AAPL", { kind: "trade" }),
      manual("m-cash", "2024-01-01", "USD", { kind: "cash", operation: "Cash In", sum: 100 }),
    ];
    const { transactions } = mergeSnaptradeSyncSafe({ existing, incoming: [], updateFromYmd: null });
    assert.equal(transactions[0]!.kind, "cash");
    assert.equal(transactions[1]!.kind, "trade");
  });
});
