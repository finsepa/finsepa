import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioGoal } from "@/components/portfolio/portfolio-types";
import {
  GOAL_DEFAULT_DIVIDEND_GROWTH_PCT,
  computePortfolioPassiveIncomeProjection,
  portfolioGoalDividendGrowthPct,
  portfolioGoalDividendYieldPct,
} from "./portfolio-goal-projections.ts";

function incomeGoal(partial: Partial<PortfolioGoal> = {}): PortfolioGoal {
  return {
    kind: "passive_income",
    targetUsd: 10_000,
    achieveByYear: 2035,
    monthlyContributionUsd: 0,
    ...partial,
  };
}

describe("portfolioGoalDividendYieldPct", () => {
  it("prefers the saved yield over the live holdings yield", () => {
    assert.equal(portfolioGoalDividendYieldPct(incomeGoal({ dividendYieldPct: 2 }), 0.19), 2);
  });

  it("falls back to the live holdings yield", () => {
    assert.equal(portfolioGoalDividendYieldPct(incomeGoal(), 0.19), 0.19);
  });
});

describe("portfolioGoalDividendGrowthPct", () => {
  it("defaults to 5% when unset", () => {
    assert.equal(portfolioGoalDividendGrowthPct(incomeGoal()), GOAL_DEFAULT_DIVIDEND_GROWTH_PCT);
  });
});

describe("computePortfolioPassiveIncomeProjection", () => {
  const now = new Date(2026, 8, 3);

  it("starts at equity × yield and grows yield by the dividend-growth rate", () => {
    const projection = computePortfolioPassiveIncomeProjection(
      100_000,
      incomeGoal({ dividendYieldPct: 2, dividendGrowthPct: 5 }),
      { currentAnnualIncomeUsd: 466.8, now },
    );
    assert.equal(projection.portfolioPoints[0]?.value, 2_000);
    const year1 = projection.portfolioPoints.find((p) => p.year === 2027);
    assert.ok(year1);
    assert.ok(year1.value > 2_000 * 1.05);
    assert.ok(year1.value < 2_000 * 1.05 ** 2);
  });

  it("uses live annual income for the progress tile, not the modeled path", () => {
    const projection = computePortfolioPassiveIncomeProjection(
      100_000,
      incomeGoal({ targetUsd: 10_000, dividendYieldPct: 2 }),
      { currentAnnualIncomeUsd: 466.8, now },
    );
    assert.ok(Math.abs(projection.progressPct - 4.668) < 1e-6);
    assert.equal(projection.portfolioPoints[0]?.value, 2_000);
  });

  it("adds monthly contributions to the income-producing principal", () => {
    const none = computePortfolioPassiveIncomeProjection(
      100_000,
      incomeGoal({ dividendYieldPct: 2, dividendGrowthPct: 0, monthlyContributionUsd: 0 }),
      { now },
    );
    const contrib = computePortfolioPassiveIncomeProjection(
      100_000,
      incomeGoal({ dividendYieldPct: 2, dividendGrowthPct: 0, monthlyContributionUsd: 1_000 }),
      { now },
    );
    const year1None = none.portfolioPoints.find((p) => p.year === 2027)?.value ?? 0;
    const year1Contrib = contrib.portfolioPoints.find((p) => p.year === 2027)?.value ?? 0;
    assert.ok(year1Contrib > year1None);
  });

  it("reports the year modeled income first reaches the target", () => {
    const projection = computePortfolioPassiveIncomeProjection(
      240_646,
      incomeGoal({
        targetUsd: 10_000,
        dividendYieldPct: 0.194,
        dividendGrowthPct: 5,
        monthlyContributionUsd: 1_000,
      }),
      { currentAnnualIncomeUsd: 466.8, now },
    );
    assert.ok(projection.achievableYear != null);
    assert.ok(projection.achievableYear >= 2026);
    const hit = projection.portfolioPoints.find((p) => p.year === projection.achievableYear);
    assert.ok(hit);
    assert.ok(hit.value >= 10_000);
  });
});
