import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FLUSH_DEBOUNCE_MS,
  MIN_FLUSH_DEBOUNCE_MS,
  resolveFlushDebounceMs,
  setPendingMinuteClose,
} from "./crypto-minute-ingest-core.mjs";

test("flush debounce defaults to six seconds and clamps values below five seconds", () => {
  assert.equal(resolveFlushDebounceMs(undefined), DEFAULT_FLUSH_DEBOUNCE_MS);
  assert.equal(resolveFlushDebounceMs("6000"), 6_000);

  const warnings = [];
  assert.equal(resolveFlushDebounceMs("2000", (message) => warnings.push(message)), MIN_FLUSH_DEBOUNCE_MS);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /clamping to 5000ms/);
});

test("repeated trades within one six-second flush window produce one pending database batch", () => {
  const pending = new Map();
  const minuteStart = 1_721_234_520;

  setPendingMinuteClose(pending, "BTC", minuteStart + 1, 60_001, "2026-07-18T17:00:01.000Z");
  setPendingMinuteClose(pending, "BTC", minuteStart + 3, 60_002, "2026-07-18T17:00:03.000Z");
  setPendingMinuteClose(pending, "BTC", minuteStart + 5, 60_003, "2026-07-18T17:00:05.000Z");

  const batch = Array.from(pending.values());
  assert.equal(batch.length, 1);
  assert.deepEqual(batch[0], {
    ticker: "BTC",
    bucket_unix: minuteStart,
    close: 60_003,
    updated_at: "2026-07-18T17:00:05.000Z",
  });
});

test("minute rollover keeps the previous and current minute as separate pending rows", () => {
  const pending = new Map();
  const minuteStart = 1_721_234_520;

  setPendingMinuteClose(pending, "BTC", minuteStart + 59, 60_010, "2026-07-18T17:00:59.000Z");
  setPendingMinuteClose(pending, "BTC", minuteStart + 60, 60_020, "2026-07-18T17:01:00.000Z");

  assert.equal(pending.size, 2);
  assert.deepEqual(
    Array.from(pending.values()).map(({ bucket_unix, close }) => ({ bucket_unix, close })),
    [
      { bucket_unix: minuteStart, close: 60_010 },
      { bucket_unix: minuteStart + 60, close: 60_020 },
    ],
  );
});
