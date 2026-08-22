import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSuperinvestorPerformancePct,
  superinvestorPerformanceHeadlineBookReturnPct,
} from "./superinvestor-performance-headline.ts";
import type { SuperinvestorPerformanceSeries } from "./superinvestor-performance-types.ts";

function series(points: { t: string; book: number; spy?: number }[]): SuperinvestorPerformanceSeries {
  return {
    slug: "test",
    label: "Test",
    benchmarkLabel: "S&P 500",
    notionalUsd: 10_000,
    fromYmd: points[0]!.t,
    toYmd: points[points.length - 1]!.t,
    points: points.map((p) => ({
      t: p.t,
      bookReturnPct: p.book,
      spyReturnPct: p.spy ?? 0,
      bookProfitUsd: 0,
      spyProfitUsd: 0,
    })),
    coveragePct: 100,
    disclaimer: "",
  };
}

test("superinvestorPerformanceHeadlineBookReturnPct rebases 1Y window", () => {
  const s = series([
    { t: "2024-01-02", book: 0 },
    { t: "2024-06-01", book: 10 },
    { t: "2025-01-02", book: 20 },
    { t: "2025-06-01", book: 30 },
  ]);
  const pct = superinvestorPerformanceHeadlineBookReturnPct(s, "1y");
  assert.ok(pct != null && Math.abs(pct - 18.2) < 0.5);
});

test("formatSuperinvestorPerformancePct signs positive values", () => {
  assert.equal(formatSuperinvestorPerformancePct(12.3), "+12.3%");
  assert.equal(formatSuperinvestorPerformancePct(-4.5), "-4.5%");
});
