import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CRYPTO_MOVE_TIERS,
  formatUsdPrice,
  lastCloseBefore,
  looksLikeUnadjustedSplit,
  referenceCloseMatchesHistory,
  splitAdjustedCloses,
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

describe("crypto tiers", () => {
  it("uses ±10% / ±20%", () => {
    assert.equal(priceMoveTier(8, CRYPTO_MOVE_TIERS), null);
    assert.deepEqual(priceMoveTier(-11, CRYPTO_MOVE_TIERS), { direction: "down", tier: 10 });
    assert.deepEqual(priceMoveTier(25, CRYPTO_MOVE_TIERS), { direction: "up", tier: 20 });
    assert.deepEqual(priceMoveEventKeys("2026-11-11", "up", 20, CRYPTO_MOVE_TIERS), [
      "move:2026-11-11:up:10",
      "move:2026-11-11:up:20",
    ]);
  });
});

describe("split guard", () => {
  it("flags a reference close that disagrees with history", () => {
    assert.equal(referenceCloseMatchesHistory(100, 101), true);
    assert.equal(referenceCloseMatchesHistory(10, 100), false);
    assert.equal(referenceCloseMatchesHistory(null, 100), true);
  });

  it("spots unadjusted split ratios but not ordinary crashes", () => {
    assert.equal(looksLikeUnadjustedSplit(10.02, 100), true); // 1:10
    assert.equal(looksLikeUnadjustedSplit(50.4, 100), true); // 1:2
    assert.equal(looksLikeUnadjustedSplit(40, 10), true); // 4:1 reverse
    assert.equal(looksLikeUnadjustedSplit(62, 100), false); // −38% real drop
    assert.equal(looksLikeUnadjustedSplit(27, 100), false);
  });

  it("finds the last close before a date", () => {
    const series: CloseBar[] = [
      { date: "2026-11-09", close: 10 },
      { date: "2026-11-10", close: 11 },
      { date: "2026-11-11", close: 12 },
    ];
    assert.equal(lastCloseBefore(series, "2026-11-11"), 11);
    assert.equal(lastCloseBefore(series, "2026-11-01"), null);
  });

  it("formats sub-cent prices", () => {
    assert.equal(formatUsdPrice(0.00001234), "$0.00001234");
    assert.equal(formatUsdPrice(0.5), "$0.50");
  });
});

describe("splitAdjustedCloses", () => {
  it("restates splits but keeps dividends out of history", () => {
    // 2:1 split on 11-05; a 1% dividend went ex on 11-09 (adjusted dips 1% before it).
    const raw = [
      { date: "2026-11-03", close: 200, adjustedClose: 99 },
      { date: "2026-11-04", close: 210, adjustedClose: 103.95 },
      { date: "2026-11-05", close: 104, adjustedClose: 102.96 },
      { date: "2026-11-06", close: 106, adjustedClose: 104.94 },
      { date: "2026-11-09", close: 105, adjustedClose: 105 },
    ];
    const out = splitAdjustedCloses(raw).map((b) => Math.round(b.close * 100) / 100);
    assert.deepEqual(out, [100, 105, 104, 106, 105]);
  });

  it("does not let a dividend-lowered history fake a new high", () => {
    // Raw high 100 a year ago; dividends since lower its adjusted value to 97. Today's price 99.
    const raw = bars(400, "2026-11-10", (i) => (i === 50 ? 100 : 90)).map((b, i) => ({
      date: b.date,
      close: b.close,
      adjustedClose: b.close * (i < 300 ? 0.97 : 1),
    }));
    const ex = priceExtremesFromCloses(splitAdjustedCloses(raw), "2026-11-11");
    assert.ok(ex);
    assert.deepEqual(detectHighLow(99, ex), []);
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

  it("ignores a cent past yesterday's record close", () => {
    const atRecord = { high52w: 428.26, low52w: 300, allTimeHigh: 428.26, allTimeLow: 50 };
    assert.deepEqual(detectHighLow(428.28, atRecord), []);
    assert.equal(detectHighLow(431, atRecord)[0]?.level, "all_time_high");
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
