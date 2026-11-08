import assert from "node:assert/strict";
import test from "node:test";

import {
  cryptoMinuteBarsHavePriceVariation,
  cryptoWsMinuteBarMinSpreadUsd,
  cryptoWsMinuteBarQuantum,
} from "./crypto-ws-minute-bar-quality.ts";

test("rejects empty / single-bar WS series", () => {
  assert.equal(cryptoMinuteBarsHavePriceVariation([]), false);
  assert.equal(
    cryptoMinuteBarsHavePriceVariation([{ time: 1, value: 65_186.71, timeZone: "UTC" }]),
    false,
  );
});

test("rejects heartbeat-flat series (constant close)", () => {
  const bars = Array.from({ length: 60 }, (_, i) => ({
    time: 1_700_000_000 + i * 60,
    value: 65_186.71,
    timeZone: "UTC" as const,
  }));
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), false);
});

test("accepts series with meaningful BTC-scale move", () => {
  const bars = [
    { time: 100, value: 65_000, timeZone: "UTC" as const },
    { time: 160, value: 65_050, timeZone: "UTC" as const },
    { time: 220, value: 65_120, timeZone: "UTC" as const },
  ];
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), true);
});

test("accepts small but real XRP-scale moves (was rejected by $1 floor)", () => {
  const bars = [
    { time: 100, value: 1.4217, timeZone: "UTC" as const },
    { time: 160, value: 1.4227, timeZone: "UTC" as const },
    { time: 220, value: 1.4246, timeZone: "UTC" as const },
  ];
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), true);
  assert.ok(cryptoWsMinuteBarMinSpreadUsd(1.42) < 0.01);
});

test("accepts SOL-scale sub-dollar moves within a short window", () => {
  const bars = [
    { time: 100, value: 104.58, timeZone: "UTC" as const },
    { time: 160, value: 104.73, timeZone: "UTC" as const },
    { time: 220, value: 104.87, timeZone: "UTC" as const },
  ];
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), true);
});

test("accepts PEPE-scale micro moves (was collapsed by 1e-4 floor / 4dp quantum)", () => {
  const bars = [
    { time: 100, value: 0.0000049, timeZone: "UTC" as const },
    { time: 160, value: 0.00000491, timeZone: "UTC" as const },
    { time: 220, value: 0.00000493, timeZone: "UTC" as const },
  ];
  assert.ok(cryptoWsMinuteBarQuantum(0.00000491) >= 1e12);
  assert.ok(cryptoWsMinuteBarMinSpreadUsd(0.00000491) < 1e-8);
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), true);
});

test("accepts GALA-scale sub-cent moves", () => {
  const bars = [
    { time: 100, value: 0.001552, timeZone: "UTC" as const },
    { time: 160, value: 0.001555, timeZone: "UTC" as const },
    { time: 220, value: 0.00156, timeZone: "UTC" as const },
  ];
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), true);
});

test("still rejects flat PEPE heartbeats", () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({
    time: 100 + i,
    value: 0.00000491,
    timeZone: "UTC" as const,
  }));
  assert.equal(cryptoMinuteBarsHavePriceVariation(bars), false);
});
