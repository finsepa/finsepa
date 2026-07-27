import assert from "node:assert/strict";
import test from "node:test";

import { cryptoMinuteBarsHavePriceVariation } from "./crypto-ws-minute-bar-quality.ts";

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
