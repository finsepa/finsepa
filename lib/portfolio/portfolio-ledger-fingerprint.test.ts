import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  portfolioLedgerFingerprint,
  portfolioWorkspacePersistFingerprint,
} from "@/lib/portfolio/portfolio-ledger-fingerprint";
import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";

function baseState(overrides?: Partial<PersistedPortfolioState>): PersistedPortfolioState {
  return {
    v: 1,
    savedAt: 1000,
    selectedPortfolioId: "p1",
    portfolios: [{ id: "p1", name: "Test", privacy: "private" }],
    holdingsByPortfolioId: {
      p1: [
        {
          id: "h1",
          symbol: "AAPL",
          name: "Apple",
          logoUrl: null,
          shares: 10,
          avgPrice: 100,
          costBasis: 1000,
          currentValue: 1100,
          marketPrice: 110,
        },
      ],
    },
    transactionsByPortfolioId: {
      p1: [
        {
          id: "t1",
          portfolioId: "p1",
          date: "2026-01-01",
          kind: "trade",
          operation: "buy",
          symbol: "AAPL",
          name: "Apple",
          logoUrl: null,
          shares: 10,
          price: 100,
          fee: 0,
          sum: -1000,
          profitPct: null,
          profitUsd: null,
        },
      ],
    },
    ...overrides,
  };
}

describe("portfolioWorkspacePersistFingerprint", () => {
  it("ignores savedAt and live mark fields", () => {
    const a = baseState({ savedAt: 1 });
    const b = baseState({
      savedAt: 999999,
      holdingsByPortfolioId: {
        p1: [
          {
            ...a.holdingsByPortfolioId.p1![0]!,
            marketPrice: 999,
            currentValue: 9990,
          },
        ],
      },
    });
    assert.equal(portfolioWorkspacePersistFingerprint(a), portfolioWorkspacePersistFingerprint(b));
    assert.notEqual(portfolioLedgerFingerprint(a), portfolioLedgerFingerprint(b));
  });

  it("changes when portfolio is renamed or removed", () => {
    const a = baseState();
    const renamed = baseState({
      portfolios: [{ id: "p1", name: "Alpaca", privacy: "private" }],
    });
    const withExtra = baseState({
      portfolios: [
        { id: "p1", name: "Test", privacy: "private" },
        { id: "p2", name: "Interactive Brokers", privacy: "private" },
      ],
      holdingsByPortfolioId: { ...a.holdingsByPortfolioId, p2: [] },
      transactionsByPortfolioId: { ...a.transactionsByPortfolioId, p2: [] },
    });
    assert.notEqual(portfolioWorkspacePersistFingerprint(a), portfolioWorkspacePersistFingerprint(renamed));
    assert.notEqual(portfolioWorkspacePersistFingerprint(a), portfolioWorkspacePersistFingerprint(withExtra));
  });
});
