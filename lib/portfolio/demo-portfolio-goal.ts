import type { PortfolioGoal } from "@/components/portfolio/portfolio-types";

/** Default demo goal — shared by client demo seed and server workspace seed. */
export function defaultDemoPortfolioGoal(now = new Date()): PortfolioGoal {
  const year = now.getFullYear();
  return {
    kind: "value",
    targetUsd: 1_000_000,
    achieveByYear: year + 5,
    monthlyContributionUsd: 2_000,
    reinvestDividends: true,
    portfolioAnnualReturnPct: 28.52,
  };
}
