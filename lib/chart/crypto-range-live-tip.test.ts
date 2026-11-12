import assert from "node:assert/strict";
import test from "node:test";

import { pinCryptoRangeTipToLive } from "./crypto-range-live-tip.ts";
import type { StockChartPoint } from "../market/stock-chart-types.ts";

const DAY = 86_400;
const day0 = 1_762_819_200; // 2025-11-11 00:00 UTC
const daily: StockChartPoint[] = [
  { time: day0 - 2 * DAY, value: 80_000, sessionDate: "2025-11-09" },
  { time: day0 - DAY, value: 78_000, sessionDate: "2025-11-10" },
  { time: day0, value: 76_000, sessionDate: "2025-11-11" },
];

test("daily: today's open bar takes the live price", () => {
  const { points, appended } = pinCryptoRangeTipToLive(daily, 72_500, day0 + 13 * 3600);
  assert.equal(appended, false);
  assert.equal(points.length, 3);
  assert.equal(points[2]!.value, 72_500);
  assert.equal(points[2]!.time, day0);
});

test("daily: closed last bar gets a new today bar at the live price", () => {
  const { points, appended } = pinCryptoRangeTipToLive(daily, 72_500, day0 + DAY + 3600);
  assert.equal(appended, true);
  assert.deepEqual(points.slice(0, 3), daily);
  assert.deepEqual(points[3], { time: day0 + DAY, value: 72_500, sessionDate: "2025-11-12" });
});

test("intraday: appends on the bar grid", () => {
  const bars: StockChartPoint[] = [
    { time: 1_000_000_080, value: 1 },
    { time: 1_000_000_320, value: 2 },
  ];
  const { points, appended } = pinCryptoRangeTipToLive(bars, 3, 1_000_000_800);
  assert.equal(appended, true);
  assert.equal(points.at(-1)!.time, 1_000_000_800 - (1_000_000_800 % 240));
  assert.equal(points.at(-1)!.value, 3);
});

test("no live price leaves points untouched", () => {
  const { points, appended } = pinCryptoRangeTipToLive(daily, null, day0);
  assert.equal(points, daily);
  assert.equal(appended, false);
});
