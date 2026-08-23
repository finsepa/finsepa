import assert from "node:assert/strict";
import test from "node:test";

import { isUsableCryptoDerivedHub, isUsableCryptoDerivedSnapshot } from "./eod-derived-metrics.ts";

test("isUsableCryptoDerivedSnapshot rejects empty cached rows", () => {
  assert.equal(
    isUsableCryptoDerivedSnapshot({
      changePercent7D: null,
      changePercent1M: null,
      changePercentYTD: null,
      last5DailyCloses: [],
    }),
    false,
  );
});

test("isUsableCryptoDerivedSnapshot accepts sparkline or return metrics", () => {
  assert.equal(
    isUsableCryptoDerivedSnapshot({
      changePercent7D: null,
      changePercent1M: null,
      changePercentYTD: null,
      last5DailyCloses: [1, 2],
    }),
    true,
  );
  assert.equal(
    isUsableCryptoDerivedSnapshot({
      changePercent7D: null,
      changePercent1M: 5,
      changePercentYTD: null,
      last5DailyCloses: [],
    }),
    true,
  );
});

test("isUsableCryptoDerivedHub rejects mostly-empty TOP10 hubs", () => {
  const empty = {
    changePercent7D: null,
    changePercent1M: null,
    changePercentYTD: null,
    last5DailyCloses: [] as number[],
  };
  const good = { ...empty, changePercent1M: 10, last5DailyCloses: [1, 2, 3, 4, 5] };
  const hub = {
    BTC: empty,
    ETH: empty,
    XRP: empty,
    BNB: empty,
    SOL: empty,
    DOGE: good,
    ADA: empty,
    TRX: empty,
    LINK: empty,
    AVAX: empty,
  };
  assert.equal(isUsableCryptoDerivedHub(hub, Object.keys(hub)), false);
  assert.equal(
    isUsableCryptoDerivedHub(
      { ...hub, BTC: good, ETH: good, XRP: good, BNB: good, SOL: good },
      Object.keys(hub),
    ),
    true,
  );
});
