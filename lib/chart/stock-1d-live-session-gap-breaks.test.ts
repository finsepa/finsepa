import assert from "node:assert/strict";
import test from "node:test";

import {
  pinLiveWsMinuteChartTail,
  stock1DLiveSessionLineDataWithGapBreaks,
  stock1DLiveSessionMinuteBucketUnix,
  STOCK_1D_LIVE_SESSION_MAX_FORWARD_FILL_SEC,
} from "./stock-1d-live-session-chart.ts";
import type { StockChartPoint } from "../market/stock-chart-types.ts";

test("inserts whitespace after gaps larger than the forward-fill budget", () => {
  const points = [
    { time: 1_000, value: 10 },
    { time: 1_060, value: 11 },
    { time: 1_060 + STOCK_1D_LIVE_SESSION_MAX_FORWARD_FILL_SEC + 60, value: 12 },
  ];
  const data = stock1DLiveSessionLineDataWithGapBreaks(points);
  assert.equal(data.length, 4);
  assert.deepEqual(data[0], { time: 1_000, value: 10 });
  assert.deepEqual(data[1], { time: 1_060, value: 11 });
  assert.deepEqual(data[2], { time: 1_120 });
  assert.deepEqual(data[3], {
    time: 1_060 + STOCK_1D_LIVE_SESSION_MAX_FORWARD_FILL_SEC + 60,
    value: 12,
  });
});

test("keeps short gaps connected", () => {
  const points = [
    { time: 1_000, value: 10 },
    { time: 1_060, value: 11 },
    { time: 1_120, value: 12 },
  ];
  const data = stock1DLiveSessionLineDataWithGapBreaks(points);
  assert.equal(data.length, 3);
  assert.ok("value" in data[0]! && "value" in data[1]! && "value" in data[2]!);
});

test("pinLiveWsMinuteChartTail does not span a multi-minute hole to now", () => {
  const now = new Date("2026-07-27T16:40:00.000Z"); // 12:40 ET
  const quoteSec = Math.floor(now.getTime() / 1000);
  const last: StockChartPoint = {
    time: Math.floor(new Date("2026-07-27T16:00:00.000Z").getTime() / 1000),
    value: 200,
    sessionDate: "2026-07-27",
    timeZone: "America/New_York",
  };
  const pinned = pinLiveWsMinuteChartTail([last], 197.5, now, "America/New_York", quoteSec);
  assert.equal(pinned.length, 1);
  assert.equal(pinned[0]!.time, last.time);
  assert.equal(pinned[0]!.value, 200);
});

test("pinLiveWsMinuteChartTail requires quote timestamp (no wall-clock fallback)", () => {
  const now = new Date("2026-07-27T16:40:30.000Z"); // 12:40:30 ET
  const last: StockChartPoint = {
    time: Math.floor(new Date("2026-07-27T16:39:00.000Z").getTime() / 1000),
    value: 200,
    sessionDate: "2026-07-27",
    timeZone: "America/New_York",
  };
  const pinned = pinLiveWsMinuteChartTail([last], 201.25, now);
  assert.equal(pinned.length, 1);
  assert.equal(pinned[0]!.value, 200);
});

test("pinLiveWsMinuteChartTail uses quote timestamp for the tip bucket", () => {
  const now = new Date("2026-07-27T16:40:30.000Z"); // 12:40:30 ET
  const quoteSec = Math.floor(new Date("2026-07-27T16:39:10.000Z").getTime() / 1000); // 12:39 ET
  const last: StockChartPoint = {
    time: Math.floor(new Date("2026-07-27T16:38:00.000Z").getTime() / 1000),
    value: 200,
    sessionDate: "2026-07-27",
    timeZone: "America/New_York",
  };
  const pinned = pinLiveWsMinuteChartTail([last], 201.25, now, "America/New_York", quoteSec);
  const expectedBucket = stock1DLiveSessionMinuteBucketUnix("2026-07-27", quoteSec, "America/New_York");
  assert.equal(pinned.length, 2);
  assert.equal(pinned[1]!.value, 201.25);
  assert.equal(pinned[1]!.time, expectedBucket);
});
