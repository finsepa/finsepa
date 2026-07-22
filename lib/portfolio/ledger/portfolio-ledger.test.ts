/**
 * Phase 1 Manual Portfolio ledger correctness tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import { replayPortfolioLedger } from "./portfolio-ledger-engine.ts";
import { migratePortfolioTransactionSequences } from "./portfolio-ledger-migrate.ts";
import {
  comparePortfolioTransactions,
  sortPortfolioTransactionsCanonical,
} from "./portfolio-ledger-order.ts";
import {
  stampNewTransaction,
  validatePortfolioLedgerMutation,
  validateWorkspaceState,
} from "./portfolio-ledger-validate.ts";
import { prepareWorkspaceLedgerForPersist } from "./portfolio-ledger-prepare.ts";
import type { PersistedPortfolioState } from "../portfolio-storage.ts";

function tx(partial: Partial<PortfolioTransaction> & Pick<PortfolioTransaction, "id" | "operation" | "date" | "sum">): PortfolioTransaction {
  return {
    portfolioId: "p1",
    kind: partial.kind ?? "trade",
    symbol: partial.symbol ?? "AAA",
    name: partial.name ?? partial.symbol ?? "AAA",
    logoUrl: null,
    shares: partial.shares ?? 0,
    price: partial.price ?? 0,
    fee: partial.fee ?? 0,
    profitPct: null,
    profitUsd: null,
    ...partial,
  };
}

describe("canonical order", () => {
  it("sorts by date then sequence then id", () => {
    const a = tx({ id: "b", operation: "Buy", date: "2024-01-02", sequence: 2, sum: -100, shares: 1, price: 100 });
    const b = tx({ id: "a", operation: "Buy", date: "2024-01-02", sequence: 1, sum: -100, shares: 1, price: 100 });
    const c = tx({ id: "c", operation: "Buy", date: "2024-01-01", sequence: 9, sum: -100, shares: 1, price: 100 });
    const sorted = sortPortfolioTransactionsCanonical([a, b, c]);
    assert.deepEqual(
      sorted.map((t) => t.id),
      ["c", "a", "b"],
    );
    assert.equal(comparePortfolioTransactions(b, a) < 0, true);
  });

  it("same transactions loaded repeatedly produce identical holdings", () => {
    const list = [
      tx({ id: "1", kind: "cash", operation: "Cash In", date: "2024-01-01", sum: 5000, shares: 5000, price: 1 }),
      tx({ id: "2", operation: "Buy", date: "2024-01-05", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "3", operation: "Sell", date: "2024-01-05", shares: 10, price: 110, sum: 1100, sequence: 2 }),
    ];
    const r1 = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    const r2 = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.deepEqual(r1.holdings, r2.holdings);
    assert.equal(r1.realizedGainUsd, r2.realizedGainUsd);
    assert.equal(r1.cashUsd, r2.cashUsd);
  });
});

describe("same-day buy/sell order", () => {
  it("buy then sell same day fully exits", () => {
    const list = [
      tx({ id: "c", kind: "cash", operation: "Cash In", date: "2024-01-01", sum: 5000, shares: 5000, price: 1, sequence: 1 }),
      tx({ id: "b", operation: "Buy", date: "2024-01-05", shares: 10, price: 100, sum: -1000, sequence: 2 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-05", shares: 10, price: 110, sum: 1100, sequence: 3 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.ok, true);
    assert.equal(r.holdings.length, 0);
    assert.equal(r.realizedGainUsd, 100);
  });

  it("sell then buy same day keeps open lot when sell is first by sequence", () => {
    const list = [
      tx({ id: "c", kind: "cash", operation: "Cash In", date: "2024-01-01", sum: 5000, shares: 5000, price: 1, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-05", shares: 10, price: 110, sum: 1100, sequence: 2 }),
      tx({ id: "b", operation: "Buy", date: "2024-01-05", shares: 10, price: 100, sum: -1000, sequence: 3 }),
    ];
    const strict = validatePortfolioLedgerMutation("p1", list);
    assert.equal(strict.ok, false);
    assert.equal(strict.errors.some((e) => e.code === "SELL_WITHOUT_POSITION"), true);
  });
});

describe("reject invalid sells", () => {
  it("orphan sell rejected", () => {
    const list = [
      tx({ id: "s", operation: "Sell", date: "2024-01-05", shares: 10, price: 110, sum: 1100, sequence: 1 }),
    ];
    const v = validatePortfolioLedgerMutation("p1", list);
    assert.equal(v.ok, false);
    assert.equal(v.errors[0]?.code, "SELL_WITHOUT_POSITION");
  });

  it("oversell rejected", () => {
    const list = [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 5, price: 100, sum: -500, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-02", shares: 10, price: 110, sum: 1100, sequence: 2 }),
    ];
    const v = validatePortfolioLedgerMutation("p1", list);
    assert.equal(v.ok, false);
    assert.equal(v.errors[0]?.code, "SELL_EXCEEDS_AVAILABLE_SHARES");
  });

  it("exact full exit accepted", () => {
    const list = [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-02", shares: 10, price: 150, sum: 1500, sequence: 2 }),
    ];
    const v = validatePortfolioLedgerMutation("p1", list);
    assert.equal(v.ok, true);
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.holdings.length, 0);
    assert.equal(r.realizedGainUsd, 500);
  });

  it("fractional crypto sell accepted", () => {
    const list = [
      tx({
        id: "b",
        operation: "Buy",
        symbol: "BTC-USD",
        date: "2024-01-01",
        shares: 0.015,
        price: 60000,
        fee: 1,
        sum: -901,
        sequence: 1,
      }),
      tx({
        id: "s",
        operation: "Sell",
        symbol: "BTC-USD",
        date: "2024-01-02",
        shares: 0.01,
        price: 70000,
        fee: 0,
        sum: 700,
        sequence: 2,
      }),
    ];
    const v = validatePortfolioLedgerMutation("p1", list);
    assert.equal(v.ok, true);
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.ok(Math.abs(r.holdings[0]!.shares - 0.005) < 1e-9);
  });

  it("two buys + partial sell average cost", () => {
    const list = [
      tx({ id: "b1", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "b2", operation: "Buy", date: "2024-01-02", shares: 10, price: 200, sum: -2000, sequence: 2 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-03", shares: 10, price: 180, sum: 1800, sequence: 3 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.ok, true);
    assert.equal(r.holdings[0]!.avgPrice, 150);
    assert.equal(r.holdings[0]!.costBasis, 1500);
    assert.equal(r.realizedGainUsd, 300);
  });

  it("invalid price / quantity / fee rejected", () => {
    const badPrice = validatePortfolioLedgerMutation("p1", [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 1, price: 0, sum: 0, sequence: 1 }),
    ]);
    assert.equal(badPrice.ok, false);
    assert.ok(badPrice.errors.some((e) => e.code === "INVALID_PRICE"));

    const badQty = validatePortfolioLedgerMutation("p1", [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: -1, price: 10, sum: 0, sequence: 1 }),
    ]);
    assert.equal(badQty.ok, false);

    const badFee = validatePortfolioLedgerMutation("p1", [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 1, price: 10, fee: -1, sum: -10, sequence: 1 }),
    ]);
    assert.equal(badFee.ok, false);
  });

  it("duplicate transaction id rejected", () => {
    const list = [
      tx({ id: "x", operation: "Buy", date: "2024-01-01", shares: 1, price: 10, sum: -10, sequence: 1 }),
      tx({ id: "x", operation: "Buy", date: "2024-01-02", shares: 1, price: 10, sum: -10, sequence: 2 }),
    ];
    const v = validatePortfolioLedgerMutation("p1", list);
    assert.equal(v.ok, false);
    assert.equal(v.errors[0]?.code, "DUPLICATE_TRANSACTION_ID");
  });
});

describe("edit/delete safety", () => {
  it("edit old buy causing later oversell rejected", () => {
    const list = [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-02", shares: 8, price: 110, sum: 880, sequence: 2 }),
    ];
    const next = list.map((t) =>
      t.id === "b" ? { ...t, shares: 5, sum: -500 } : t,
    );
    const v = validatePortfolioLedgerMutation("p1", next);
    assert.equal(v.ok, false);
    assert.equal(v.errors[0]?.code, "SELL_EXCEEDS_AVAILABLE_SHARES");
  });

  it("delete old buy causing later oversell rejected", () => {
    const list = [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-02", shares: 8, price: 110, sum: 880, sequence: 2 }),
    ];
    const next = list.filter((t) => t.id !== "b");
    const v = validatePortfolioLedgerMutation("p1", next);
    assert.equal(v.ok, false);
    assert.equal(v.errors[0]?.code, "SELL_WITHOUT_POSITION");
  });
});

describe("legacy migration", () => {
  it("assigns sequence from array order for missing sequences", () => {
    const list = [
      tx({ id: "2", operation: "Buy", date: "2024-01-05", shares: 1, price: 10, sum: -10 }),
      tx({ id: "1", operation: "Buy", date: "2024-01-05", shares: 1, price: 10, sum: -10 }),
    ];
    const m = migratePortfolioTransactionSequences(list);
    assert.equal(m.changed, true);
    assert.equal(m.transactions[0]!.sequence, 1);
    assert.equal(m.transactions[0]!.id, "2");
    assert.equal(m.transactions[1]!.sequence, 2);
    assert.equal(m.report.ambiguousSameDayGroups, 1);
  });

  it("prepare tags legacy orphan sells without deleting them", () => {
    const state: PersistedPortfolioState = {
      v: 1,
      portfolios: [{ id: "p1", name: "Test", privacy: "private", kind: "standard" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: {
        p1: [
          tx({ id: "orphan", operation: "Sell", date: "2024-01-05", shares: 1, price: 10, sum: 10 }),
        ],
      },
    };
    const { state: next, report } = prepareWorkspaceLedgerForPersist(state);
    assert.equal(next.transactionsByPortfolioId.p1![0]!.legacyAnomaly, true);
    assert.equal(report.legacyTaggedByPortfolio.p1?.[0], "orphan");
    assert.equal(next.transactionsByPortfolioId.p1!.length, 1);
    const v = validateWorkspaceState(next, { allowLegacyAnomalies: true, strict: true });
    assert.equal(v.ok, true);
    assert.ok(v.warnings.length >= 1);
  });

  it("stampNewTransaction increments sequence", () => {
    const existing = [
      tx({ id: "a", operation: "Buy", date: "2024-01-01", shares: 1, price: 10, sum: -10, sequence: 3 }),
    ];
    const stamped = stampNewTransaction(
      existing,
      tx({ id: "b", operation: "Buy", date: "2024-01-02", shares: 1, price: 10, sum: -10 }),
    );
    assert.equal(stamped.sequence, 4);
    assert.ok(typeof stamped.createdAt === "string");
  });
});

describe("phase 0 scenarios A B F H I J", () => {
  it("A simple buy up", () => {
    const list = [
      tx({ id: "c", kind: "cash", operation: "Cash In", date: "2024-01-01", sum: 10000, shares: 10000, price: 1, sequence: 1 }),
      tx({ id: "b", operation: "Buy", date: "2024-01-02", shares: 10, price: 100, sum: -1000, sequence: 2 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.cashUsd, 9000);
    assert.equal(r.holdings[0]!.costBasis, 1000);
    assert.equal(r.holdings[0]!.shares, 10);
  });

  it("B partial sell", () => {
    const list = [
      tx({ id: "b1", operation: "Buy", symbol: "BBB", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "b2", operation: "Buy", symbol: "BBB", date: "2024-01-02", shares: 10, price: 200, sum: -2000, sequence: 2 }),
      tx({ id: "s", operation: "Sell", symbol: "BBB", date: "2024-01-03", shares: 10, price: 180, sum: 1800, sequence: 3 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.realizedGainUsd, 300);
    assert.equal(r.holdings[0]!.avgPrice, 150);
  });

  it("F crypto fractional", () => {
    const list = [
      tx({
        id: "b",
        operation: "Buy",
        symbol: "BTC-USD",
        date: "2024-01-01",
        shares: 0.015,
        price: 60000,
        fee: 1,
        sum: -901,
        sequence: 1,
      }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.holdings[0]!.costBasis, 901);
  });

  it("H chronological dates ok", () => {
    const list = [
      tx({ id: "s", operation: "Sell", date: "2024-01-10", shares: 5, price: 110, sum: 550, sequence: 2 }),
      tx({ id: "b", operation: "Buy", date: "2024-01-05", shares: 10, price: 100, sum: -1000, sequence: 1 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.ok, true);
    assert.equal(r.holdings[0]!.shares, 5);
    assert.equal(r.realizedGainUsd, 50);
  });

  it("I after delete sell", () => {
    const list = [
      tx({ id: "b", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.holdings[0]!.shares, 10);
  });

  it("J full exit and rebuy", () => {
    const list = [
      tx({ id: "b1", operation: "Buy", date: "2024-01-01", shares: 10, price: 100, sum: -1000, sequence: 1 }),
      tx({ id: "s", operation: "Sell", date: "2024-01-02", shares: 10, price: 150, sum: 1500, sequence: 2 }),
      tx({ id: "b2", operation: "Buy", date: "2024-02-01", shares: 5, price: 140, sum: -700, sequence: 3 }),
    ];
    const r = replayPortfolioLedger(list, { mode: "strict", portfolioId: "p1" });
    assert.equal(r.realizedGainUsd, 500);
    assert.equal(r.holdings[0]!.costBasis, 700);
  });
});
