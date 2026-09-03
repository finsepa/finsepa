import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StockChartPoint } from "../../market/stock-chart-types.ts";
import {
  lastBenchmarkValueOnOrBeforeTime,
  mergeEodWithIntradayBenchmarkPoints,
  sortBenchmarkChartPoints,
} from "./benchmark-chart-points.ts";

function pt(time: number, value: number, sessionDate?: string): StockChartPoint {
  return { time, value, sessionDate };
}

describe("benchmark chart points", () => {
  it("picks the last intraday mark on or before a timestamp", () => {
    const sorted = sortBenchmarkChartPoints([
      pt(100, 10),
      pt(200, 11),
      pt(300, 12),
    ]);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(sorted, 99), null);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(sorted, 100), 10);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(sorted, 250), 11);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(sorted, 300), 12);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(sorted, 999), 12);
  });

  it("keeps EOD before the first intraday bar and uses intraday in the window", () => {
    const merged = mergeEodWithIntradayBenchmarkPoints(
      [pt(50, 9, "2026-08-20"), pt(150, 10.5, "2026-08-25"), pt(400, 13, "2026-09-01")],
      [pt(200, 11), pt(260, 11.4), pt(300, 12)],
    );
    assert.deepEqual(
      merged.map((p) => p.time),
      [50, 150, 200, 260, 300],
    );
    assert.equal(lastBenchmarkValueOnOrBeforeTime(merged, 230), 11);
    assert.equal(lastBenchmarkValueOnOrBeforeTime(merged, 280), 11.4);
  });
});
