import assert from "node:assert/strict";
import test from "node:test";

import { isUsableCryptoDerivedSnapshot } from "./eod-derived-metrics.ts";

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
