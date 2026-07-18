import assert from "node:assert/strict";
import test from "node:test";

import { pinCryptoLive1DChartTip } from "./crypto-live-1d-chart-tip.ts";
import type { StockChartPoint } from "../market/stock-chart-types.ts";

const history: StockChartPoint[] = [
  { time: 1_721_234_400, value: 64_000, timeZone: "UTC" },
  { time: 1_721_234_520, value: 64_100, timeZone: "UTC" },
];

test("pins tip to live WS price and timestamp without rewriting history", () => {
  const tipTime = 1_721_234_580;
  const pinned = pinCryptoLive1DChartTip(history, 64_250.5, tipTime);

  assert.equal(pinned.length, 3);
  assert.deepEqual(pinned.slice(0, 2), history);
  assert.deepEqual(pinned[2], {
    time: tipTime,
    value: 64_250.5,
    timeZone: "UTC",
  });
});

test("replaces only the last point when tip time already matches", () => {
  const lastTime = history[1]!.time;
  const pinned = pinCryptoLive1DChartTip(history, 64_199, lastTime);

  assert.equal(pinned.length, 2);
  assert.deepEqual(pinned[0], history[0]);
  assert.deepEqual(pinned[1], {
    time: lastTime,
    value: 64_199,
    timeZone: "UTC",
  });
});

test("falls back to existing series when live WS price is missing", () => {
  assert.deepEqual(pinCryptoLive1DChartTip(history, null, 1_721_234_580), [...history]);
  assert.deepEqual(pinCryptoLive1DChartTip(history, 0, 1_721_234_580), [...history]);
  assert.deepEqual(pinCryptoLive1DChartTip(history, 64_250, null), [...history]);
});

test("does not rewrite history when tip timestamp is older than the last point", () => {
  const pinned = pinCryptoLive1DChartTip(history, 64_250, history[0]!.time);
  assert.deepEqual(pinned, [...history]);
});
