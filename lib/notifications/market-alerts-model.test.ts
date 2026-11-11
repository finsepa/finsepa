import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectHighLow,
  highLowCopy,
  highLowEventKey,
  isoWeekKey,
  priceExtremesFromCloses,
  priceMoveCopy,
  priceMoveEventKeys,
  priceMoveTier,
  type CloseBar,
} from "./market-alerts-model.ts";

function bars(count: number, endYmd: string, closeAt: (i: number) => number): CloseBar[] {
  const out: CloseBar[] = [];
  const end = new Date(`${endYmd}T00:00:00Z`);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), close: closeAt(count - 1 - i) });
  }
  return out;
}

describe("priceMoveTier", () => {
  it("fires at 5% and 10% in either direction", () => {
    assert.equal(priceMoveTier(4.99), null);
    assert.deepEqual(priceMoveTier(5), { direction: "up", tier: 5 });
    assert.deepEqual(priceMoveTier(-7.2), { direction: "down", tier: 5 });
    assert.deepEqual(priceMoveTier(-12), { direction: "down", tier: 10 });
    assert.equal(priceMoveTier(null), null);
  });

  it("records lower tiers so a 10% day never re-fires at 5%", () => {
    assert.deepEqual(priceMoveEventKeys("2026-11-11", "up", 10), ["move:2026-11-11:up:5", "move:2026-11-11:up:10"]);
    assert.deepEqual(priceMoveEventKeys("2026-11-11", "down", 5), ["move:2026-11-11:down:5"]);
  });
});

describe("priceExtremesFromCloses", () => {
  it("ignores today's bar and needs a year of history", () => {
    assert.equal(priceExtremesFromCloses(bars(100, "2026-11-10", () => 10), "2026-11-11"), null);
    const series = bars(800, "2026-11-11", (i) => (i === 799 ? 999 : 50 + (i % 30)));
    const ex = priceExtremesFromCloses(series, "2026-11-11");
    assert.ok(ex);
    assert.notEqual(ex.allTimeHigh, 999);
  });

  it("separates the 52-week window from all-time", () => {
    // Old peak at 200 two years ago, last year trades 90–110.
    const series = bars(800, "2026-11-10", (i) => (i === 10 ? 200 : i < 400 ? 100 : 90 + (i % 21)));
    const ex = priceExtremesFromCloses(series, "2026-11-11");
    assert.ok(ex);
    assert.equal(ex.allTimeHigh, 200);
    assert.equal(ex.high52w, 110);
    assert.equal(ex.low52w, 90);
  });
});

describe("detectHighLow", () => {
  const ex = { high52w: 110, low52w: 90, allTimeHigh: 200, allTimeLow: 40 };
  it("reports the strongest level once per side", () => {
    assert.deepEqual(detectHighLow(120, ex), [{ level: "52w_high", side: "high", previous: 110 }]);
    assert.deepEqual(detectHighLow(250, ex), [{ level: "all_time_high", side: "high", previous: 200 }]);
    assert.deepEqual(detectHighLow(85, ex), [{ level: "52w_low", side: "low", previous: 90 }]);
    assert.deepEqual(detectHighLow(100, ex), []);
  });

  it("keys one high and one low per ISO week", () => {
    assert.equal(isoWeekKey("2026-11-11"), "2026-W46");
    assert.equal(isoWeekKey("2027-01-01"), "2026-W53");
    assert.equal(highLowEventKey("high", "2026-11-09"), highLowEventKey("high", "2026-11-13"));
    assert.notEqual(highLowEventKey("high", "2026-11-13"), highLowEventKey("high", "2026-11-16"));
  });
});

describe("copy", () => {
  it("formats moves and new highs", () => {
    assert.deepEqual(priceMoveCopy({ ticker: "NVDA", companyName: "NVIDIA", price: 212.4, changePct: -6.18 }), {
      title: "NVDA is down 6.2% today",
      body: "NVIDIA · $212.40",
    });
    assert.deepEqual(
      highLowCopy({
        ticker: "AAPL",
        companyName: "Apple",
        price: 260,
        hit: { level: "all_time_high", side: "high", previous: 255.5 },
      }),
      { title: "AAPL hit a new all-time high", body: "Apple · $260.00 · previous high $255.50" },
    );
  });
});
