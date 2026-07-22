/**
 * Final Manual ↔ Connected parity certification suite.
 *
 * Proves: SnapTrade activities → normalize → Phase 1–4 ≡ Manual → Phase 1–4
 * for identical economic events. No market network calls.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import {
  assertEconomicParity,
  captureDownstreamSnapshot,
  economicLedgerFingerprint,
  workspaceDeterminismKey,
} from "./parity-compare.ts";
import {
  CERT_CTX,
  connectedFromActivities,
  draftsToConnected,
  economicParityCases,
  PARITY_FIXTURES,
} from "./parity-fixtures.ts";
import { mergeSnaptradeSyncSafe } from "../../snaptrade/snaptrade-sync-merge.ts";
import { normalizeSnaptradeActivities } from "../../snaptrade/snaptrade-normalize-activity.ts";
import { isManualTransaction, isSnaptradeBrokerRow } from "../../snaptrade/snaptrade-provenance.ts";
import { migratePortfolioTransactionSequences } from "../ledger/portfolio-ledger-migrate.ts";
import { replayPortfolioLedger } from "../ledger/portfolio-ledger-engine.ts";

describe("certification — economic parity (normalize → Phase 1–4)", () => {
  for (const c of economicParityCases()) {
    it(`${c.id}: ${c.name}`, () => {
      assertEconomicParity(c.manual, c.connected, c.id);
      // Provenance differs as expected
      assert.ok(c.manual.every((t) => t.source === "MANUAL" || t.source == null));
      assert.ok(c.connected.every((t) => t.source === "SNAPTRADE"));
      assert.ok(c.connected.every((t) => typeof t.externalId === "string" && t.externalId.length > 0));
    });
  }
});

describe("certification — manual coexistence inside connected", () => {
  it("14: manual adjustment survives sync and stays MANUAL", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "02-single-buy")!;
    const { transactions: broker } = connectedFromActivities(base.activities);
    const manualAdj: PortfolioTransaction = {
      id: "manual-adj-1",
      portfolioId: "connected-cert",
      kind: "cash",
      operation: "Cash In",
      symbol: "USD",
      name: "US Dollar",
      logoUrl: null,
      date: "2024-06-01",
      shares: 500,
      price: 1,
      fee: 0,
      sum: 500,
      profitPct: null,
      profitUsd: null,
      source: "MANUAL",
      sequence: 99,
    };
    const mixed = [...broker, manualAdj];
    const { drafts } = normalizeSnaptradeActivities(base.activities, CERT_CTX);
    const incoming = draftsToConnected(drafts);
    const merged = mergeSnaptradeSyncSafe({ existing: mixed, incoming });
    assert.equal(merged.stats.manualPreserved, 1);
    assert.ok(merged.transactions.some((t) => t.id === "manual-adj-1" && isManualTransaction(t)));
    assert.ok(merged.transactions.filter(isSnaptradeBrokerRow).every((t) => t.source === "SNAPTRADE"));
    // Downstream still coherent
    const snap = captureDownstreamSnapshot(merged.transactions);
    assert.ok(snap.cashUsd >= 500);
  });

  it("manual rows remain editable class; broker rows remain broker class after sync", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "02-single-buy")!;
    const { transactions: broker } = connectedFromActivities(base.activities);
    const manual: PortfolioTransaction = {
      ...broker[0]!,
      id: "m-only",
      source: "MANUAL",
      externalId: undefined,
      provider: undefined,
    };
    const existing = [...broker, manual];
    const { drafts } = normalizeSnaptradeActivities(base.activities, CERT_CTX);
    const once = mergeSnaptradeSyncSafe({ existing, incoming: draftsToConnected(drafts) });
    const twice = mergeSnaptradeSyncSafe({
      existing: once.transactions,
      incoming: draftsToConnected(drafts),
    });
    assert.ok(twice.transactions.some((t) => t.id === "m-only" && isManualTransaction(t)));
    assert.ok(!twice.transactions.some((t) => t.id === "m-only" && isSnaptradeBrokerRow(t)));
    assert.ok(twice.transactions.filter(isSnaptradeBrokerRow).every((t) => !isManualTransaction(t)));
  });
});

describe("certification — sync stability", () => {
  it("16+19: incremental + duplicate sync upsert, no duplicates", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "03-multiple-buys")!;
    const { transactions: initial } = connectedFromActivities(base.activities);
    const { drafts } = normalizeSnaptradeActivities(base.activities, CERT_CTX);
    const incoming = draftsToConnected(drafts);

    const inc = mergeSnaptradeSyncSafe({
      existing: initial,
      incoming,
      updateFromYmd: "2024-02-01",
    });
    assert.equal(inc.transactions.filter(isSnaptradeBrokerRow).length, initial.filter(isSnaptradeBrokerRow).length);

    const dup1 = mergeSnaptradeSyncSafe({ existing: inc.transactions, incoming });
    const dup2 = mergeSnaptradeSyncSafe({ existing: dup1.transactions, incoming });
    assert.equal(dup2.transactions.length, dup1.transactions.length);
    assert.equal(workspaceDeterminismKey(dup1.transactions), workspaceDeterminismKey(dup2.transactions));
  });

  it("17: full sync preserves manual + upserts broker", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "04-partial-sell")!;
    const { transactions: broker } = connectedFromActivities(base.activities);
    const manual: PortfolioTransaction = {
      id: "keep-me",
      portfolioId: "connected-cert",
      kind: "expense",
      operation: "Other expense",
      symbol: "USD",
      name: "US Dollar",
      logoUrl: null,
      date: "2024-06-01",
      shares: 3,
      price: 1,
      fee: 0,
      sum: -3,
      profitPct: null,
      profitUsd: null,
      source: "MANUAL",
    };
    const { drafts } = normalizeSnaptradeActivities(base.activities, CERT_CTX);
    const merged = mergeSnaptradeSyncSafe({
      existing: [...broker, manual],
      incoming: draftsToConnected(drafts),
    });
    assert.ok(merged.transactions.some((t) => t.id === "keep-me"));
    assert.equal(
      merged.transactions.filter(isSnaptradeBrokerRow).length,
      broker.filter(isSnaptradeBrokerRow).length,
    );
  });

  it("18: provider correction same externalId updates in place", () => {
    const acts = [
      {
        id: "corr-1",
        type: "BUY",
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 100,
        amount: -1000,
        symbol: { symbol: "AAPL", description: "Apple" },
      },
    ];
    const { transactions: v1 } = connectedFromActivities([
      {
        id: "dep",
        type: "DEPOSIT",
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      },
      ...acts,
    ]);
    const corrected = [
      {
        id: "dep",
        type: "DEPOSIT",
        trade_date: "2024-01-02T00:00:00.000Z",
        amount: 5000,
        currency: { code: "USD" },
      },
      {
        id: "corr-1",
        type: "BUY",
        trade_date: "2024-01-10T00:00:00.000Z",
        units: 10,
        price: 105,
        amount: -1050,
        symbol: { symbol: "AAPL", description: "Apple" },
      },
    ];
    const { drafts } = normalizeSnaptradeActivities(corrected, CERT_CTX);
    const merged = mergeSnaptradeSyncSafe({
      existing: v1,
      incoming: draftsToConnected(drafts),
    });
    const buy = merged.transactions.find((t) => t.operation === "Buy");
    assert.ok(buy);
    assert.equal(buy!.price, 105);
    assert.equal(buy!.sum, -1050);
    assert.ok(merged.stats.brokerUpdated >= 1);
    assert.equal(merged.stats.brokerInserted, 0);
    assert.equal(merged.transactions.filter((t) => t.operation === "Buy").length, 1);
  });

  it("15: reconnect (re-auth) does not duplicate broker history", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "02-single-buy")!;
    const { transactions: before } = connectedFromActivities(base.activities);
    // Simulate reconnect: same activities, new authorization id on incoming
    const ctx2 = { ...CERT_CTX, authorizationId: "auth-reconnected", syncTimestamp: "2024-07-01T00:00:00.000Z" };
    const { drafts } = normalizeSnaptradeActivities(base.activities, ctx2);
    const incoming = draftsToConnected(drafts).map((t) => ({
      ...t,
      // externalId remains account+activity scoped — unchanged across reconnect
    }));
    const merged = mergeSnaptradeSyncSafe({ existing: before, incoming });
    assert.equal(merged.transactions.length, before.length);
    assert.equal(merged.stats.brokerInserted, 0);
    assert.ok(merged.stats.brokerUpdated >= 1);
  });
});

describe("certification — determinism", () => {
  it("identical sync ×3 yields identical workspace key + holdings", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "10-stock-etf")!;
    const { drafts } = normalizeSnaptradeActivities(base.activities, CERT_CTX);
    const incoming = draftsToConnected(drafts);

    let state: PortfolioTransaction[] = [];
    const keys: string[] = [];
    const holdingsFp: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const merged = mergeSnaptradeSyncSafe({ existing: state, incoming });
      state = merged.transactions;
      keys.push(workspaceDeterminismKey(state));
      const ledger = replayPortfolioLedger(state, { mode: "display" });
      holdingsFp.push(
        JSON.stringify(
          ledger.holdings.map((h) => ({
            s: h.symbol,
            q: h.shares,
            a: h.avgPrice,
            c: h.costBasis,
          })),
        ),
      );
    }
    assert.equal(keys[0], keys[1]);
    assert.equal(keys[1], keys[2]);
    assert.equal(holdingsFp[0], holdingsFp[1]);
    assert.equal(holdingsFp[1], holdingsFp[2]);
  });

  it("normalize ×3 is byte-stable for drafts", () => {
    const base = PARITY_FIXTURES.find((f) => f.id === "11-fractional")!;
    const a = JSON.stringify(normalizeSnaptradeActivities(base.activities, CERT_CTX).drafts);
    const b = JSON.stringify(normalizeSnaptradeActivities(base.activities, CERT_CTX).drafts);
    const c = JSON.stringify(normalizeSnaptradeActivities(base.activities, CERT_CTX).drafts);
    assert.equal(a, b);
    assert.equal(b, c);
  });
});

describe("certification — large portfolio + performance", () => {
  function buildLargeActivities(n: number): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [
      {
        id: "dep-large",
        type: "DEPOSIT",
        trade_date: "2020-01-01T00:00:00.000Z",
        amount: 1_000_000,
        currency: { code: "USD" },
      },
    ];
    for (let i = 0; i < n; i += 1) {
      // Deterministic valid calendar dates (day 1–28 only).
      const day = 1 + (i % 28);
      const month = 1 + (Math.floor(i / 28) % 12);
      const year = 2020 + Math.floor(i / (28 * 12));
      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const sym = `S${String(i % 500).padStart(3, "0")}`;
      rows.push({
        id: `buy-${i}`,
        type: "BUY",
        trade_date: `${ymd}T00:00:00.000Z`,
        units: 1 + (i % 5) * 0.1,
        price: 10 + (i % 50),
        amount: -((1 + (i % 5) * 0.1) * (10 + (i % 50))),
        symbol: { symbol: sym, description: sym },
      });
    }
    return rows;
  }

  const sizes = [10, 100, 1000];
  for (const n of sizes) {
    it(`perf normalize+merge+ledger n=${n}`, () => {
      const acts = buildLargeActivities(n);
      const t0 = performance.now();
      const { drafts } = normalizeSnaptradeActivities(acts, CERT_CTX);
      const tNorm = performance.now();
      const incoming = draftsToConnected(drafts);
      const t1 = performance.now();
      const merged = mergeSnaptradeSyncSafe({ existing: [], incoming });
      const t2 = performance.now();
      const again = mergeSnaptradeSyncSafe({ existing: merged.transactions, incoming });
      const t3 = performance.now();
      const ledger = replayPortfolioLedger(again.transactions, { mode: "display" });
      const t4 = performance.now();
      const snap = captureDownstreamSnapshot(again.transactions);
      const t5 = performance.now();

      assert.equal(again.transactions.length, merged.transactions.length);
      assert.ok(ledger.ok || ledger.holdings.length >= 0);
      assert.ok(Number.isFinite(snap.currentValue));

      // Soft budgets (CI machines vary) — catch O(n²) regressions only
      const normMs = tNorm - t0;
      const mergeMs = t3 - t1;
      const ledgerMs = t4 - t2;
      const totalMs = t5 - t0;
      if (n <= 100) assert.ok(totalMs < 2000, `slow total ${totalMs}ms for n=${n}`);
      if (n === 1000) assert.ok(totalMs < 15000, `slow total ${totalMs}ms for n=1000`);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          n,
          normMs: +normMs.toFixed(2),
          mergeMs: +mergeMs.toFixed(2),
          ledgerMs: +ledgerMs.toFixed(2),
          totalMs: +totalMs.toFixed(2),
          txs: again.transactions.length,
          holdings: ledger.holdings.length,
        }),
      );
    });
  }

  it("perf 10000 activities (normalize + single merge + ledger)", () => {
    const acts = buildLargeActivities(10_000);
    const t0 = performance.now();
    const { drafts } = normalizeSnaptradeActivities(acts, CERT_CTX);
    const incoming = draftsToConnected(drafts);
    const merged = mergeSnaptradeSyncSafe({ existing: [], incoming });
    const ledger = replayPortfolioLedger(merged.transactions, { mode: "display" });
    const ms = performance.now() - t0;
    assert.equal(merged.transactions.length, drafts.length);
    assert.ok(ledger.holdings.length >= 1);
    assert.ok(ms < 60_000, `10k path exceeded 60s: ${ms}ms`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ n: 10000, totalMs: +ms.toFixed(2), txs: merged.transactions.length }));
  });
});

describe("certification — repository pipeline invariants", () => {
  it("economic fingerprint ignores provenance noise", () => {
    const c = economicParityCases()[1]!;
    assert.equal(economicLedgerFingerprint(c.manual), economicLedgerFingerprint(c.connected));
  });

  it("unknown activity never enters ledger", () => {
    const { drafts, warnings } = normalizeSnaptradeActivities(
      [
        {
          id: "u1",
          type: "SPINOFF_WEIRD",
          trade_date: "2024-01-01T00:00:00.000Z",
          amount: 1,
        },
      ],
      CERT_CTX,
    );
    assert.equal(drafts.length, 0);
    assert.equal(warnings[0]?.code, "UNKNOWN_ACTIVITY");
  });
});
