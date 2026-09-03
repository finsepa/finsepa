import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePersistedPortfolioUnknown, mergePersistedPortfolioGoals } from "@/lib/portfolio/portfolio-storage";

describe("portfolio-storage goals", () => {
  it("round-trips goalByPortfolioId in workspace JSON", () => {
    const body = {
      v: 1,
      savedAt: 1_700_000_000_000,
      portfolios: [{ id: "p1", name: "Main", privacy: "private" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: { p1: [] },
      goalByPortfolioId: {
        p1: {
          kind: "value",
          targetUsd: 500_000,
          achieveByYear: 2030,
          monthlyContributionUsd: 1_000,
          reinvestDividends: true,
        },
        p2: null,
      },
    };

    const parsed = parsePersistedPortfolioUnknown(body);
    assert.ok(parsed);
    assert.deepEqual(parsed.goalByPortfolioId?.p1, body.goalByPortfolioId.p1);
    assert.equal(parsed.goalByPortfolioId?.p2, undefined);
  });

  it("round-trips a passive-income goal with yield and growth", () => {
    const body = {
      v: 1,
      savedAt: 1_700_000_000_000,
      portfolios: [{ id: "p1", name: "Main", privacy: "private" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: { p1: [] },
      goalByPortfolioId: {
        p1: {
          kind: "passive_income",
          targetUsd: 10_000,
          achieveByYear: 2035,
          monthlyContributionUsd: 0,
          dividendYieldPct: 0.19,
          dividendGrowthPct: 5,
        },
      },
    };

    const parsed = parsePersistedPortfolioUnknown(body);
    assert.ok(parsed);
    assert.deepEqual(parsed.goalByPortfolioId?.p1, body.goalByPortfolioId.p1);
  });

  it("leaves goalByPortfolioId absent when the blob has no goal field", () => {
    const body = {
      v: 1,
      savedAt: 1_700_000_000_000,
      portfolios: [{ id: "p1", name: "Main", privacy: "private" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: { p1: [] },
    };

    const parsed = parsePersistedPortfolioUnknown(body);
    assert.ok(parsed);
    assert.equal(parsed.goalByPortfolioId, undefined);
  });

  it("mergePersistedPortfolioGoals keeps local goals when remote has none", () => {
    const local = parsePersistedPortfolioUnknown({
      v: 1,
      portfolios: [{ id: "p1", name: "Main", privacy: "private" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: { p1: [] },
      goalByPortfolioId: {
        p1: {
          kind: "value",
          targetUsd: 500_000,
          achieveByYear: 2030,
          monthlyContributionUsd: 1_000,
          reinvestDividends: true,
        },
      },
    });
    const remote = parsePersistedPortfolioUnknown({
      v: 1,
      savedAt: 1_800_000_000_000,
      portfolios: [{ id: "p1", name: "Main", privacy: "private" }],
      selectedPortfolioId: "p1",
      holdingsByPortfolioId: { p1: [] },
      transactionsByPortfolioId: { p1: [] },
    });
    assert.ok(local && remote);
    const merged = mergePersistedPortfolioGoals(local, remote);
    assert.deepEqual(merged.goalByPortfolioId?.p1, local.goalByPortfolioId?.p1);
  });
});
