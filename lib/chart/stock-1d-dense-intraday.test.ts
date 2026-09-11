import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  liveSessionSourceIsDenseIntraday,
  STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC,
} from "@/lib/chart/stock-1d-live-session-chart";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

function pts(times: number[]): StockChartPoint[] {
  return times.map((time, i) => ({ time, value: 100 + i }));
}

describe("liveSessionSourceIsDenseIntraday", () => {
  const open = 1_000_000;
  const end = open + 6.5 * 3600;

  it("treats ~1m bars as dense", () => {
    const times: number[] = [];
    for (let t = open; t <= open + 20 * 60; t += STOCK_1D_LIVE_SESSION_BAR_INTERVAL_SEC) {
      times.push(t);
    }
    assert.equal(liveSessionSourceIsDenseIntraday(pts(times), open, end), true);
  });

  it("treats 5m bars as coarse (must resample to 1m)", () => {
    const times: number[] = [];
    for (let t = open; t <= open + 60 * 60; t += 5 * 60) {
      times.push(t);
    }
    assert.equal(liveSessionSourceIsDenseIntraday(pts(times), open, end), false);
  });
});
