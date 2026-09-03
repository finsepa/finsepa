import { describe, expect, it } from "vitest";

import { averageAnnualPortfolioReturnPct } from "@/lib/portfolio/portfolio-average-annual-return";

describe("averageAnnualPortfolioReturnPct", () => {
  it("returns arithmetic mean of finite annual portfolio returns", () => {
    const avg = averageAnnualPortfolioReturnPct([
      { label: "2024", periodStart: "2024-01-01", periodEnd: "2024-12-31", portfolioPct: 10, benchmarkPct: null, nasdaqPct: null },
      { label: "2025", periodStart: "2025-01-01", periodEnd: "2025-12-31", portfolioPct: 20, benchmarkPct: null, nasdaqPct: null },
      { label: "2026", periodStart: "2026-01-01", periodEnd: "2026-12-31", portfolioPct: null, benchmarkPct: null, nasdaqPct: null },
    ]);
    expect(avg).toBe(15);
  });

  it("returns null when no annual returns exist", () => {
    expect(averageAnnualPortfolioReturnPct([])).toBeNull();
    expect(
      averageAnnualPortfolioReturnPct([
        { label: "2026", periodStart: "2026-01-01", periodEnd: "2026-12-31", portfolioPct: null, benchmarkPct: null, nasdaqPct: null },
      ]),
    ).toBeNull();
  });
});
