import assert from "node:assert/strict";
import test from "node:test";

import {
  accumulateCryptoMinuteBarPages,
  CRYPTO_MINUTE_BAR_READ_LIMIT,
  CRYPTO_MINUTE_BAR_READ_PAGE_SIZE,
  mapCryptoMinuteBarRows,
} from "./crypto-session-minute-bar-rows.ts";

test("read limit is above PostgREST default and covers a full 24h 1m window", () => {
  assert.ok(CRYPTO_MINUTE_BAR_READ_LIMIT > 1000);
  assert.ok(CRYPTO_MINUTE_BAR_READ_LIMIT >= 1440);
  assert.equal(CRYPTO_MINUTE_BAR_READ_PAGE_SIZE, 1000);
});

test("paginated accumulate merges >1000 rows and keeps the newest", () => {
  const fromUnix = 1_721_234_000;
  const rowCount = 1440;
  const allRows = Array.from({ length: rowCount }, (_, i) => ({
    bucket_unix: fromUnix + i * 60,
    close: 60_000 + i,
  }));

  const page1 = allRows.slice(0, 1000);
  const page2 = allRows.slice(1000);
  assert.equal(page1.length, 1000);
  assert.equal(page2.length, 440);

  const acc: { bucket_unix: number; close: number }[] = [];
  const mid = accumulateCryptoMinuteBarPages(acc, page1);
  assert.equal(mid.done, false);
  assert.equal(mid.rows.length, 1000);

  const end = accumulateCryptoMinuteBarPages(acc, page2);
  assert.equal(end.done, true);
  assert.equal(end.rows.length, 1440);

  const points = mapCryptoMinuteBarRows(end.rows);
  assert.equal(points.length, 1440);
  assert.ok(points.length > 1000);
  assert.equal(points[0]!.time, fromUnix);
  assert.equal(points[points.length - 1]!.time, fromUnix + (rowCount - 1) * 60);
  assert.equal(points[points.length - 1]!.value, 60_000 + rowCount - 1);
});

test("mapCryptoMinuteBarRows preserves ascending chronological order", () => {
  const rows = [
    { bucket_unix: 300, close: 3 },
    { bucket_unix: 60, close: 1 },
    { bucket_unix: 180, close: 2 },
  ];
  const points = mapCryptoMinuteBarRows(rows);

  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i]!.time > points[i - 1]!.time);
  }
  assert.deepEqual(
    points.map((p) => p.time),
    [60, 180, 300],
  );
});

test("mapCryptoMinuteBarRows does not introduce duplicate bucket times", () => {
  const rows = [
    { bucket_unix: 60, close: 1 },
    { bucket_unix: 60, close: 99 },
    { bucket_unix: 120, close: 2 },
    { bucket_unix: 120, close: 88 },
    { bucket_unix: 180, close: 3 },
  ];
  const points = mapCryptoMinuteBarRows(rows);

  assert.equal(points.length, 3);
  assert.deepEqual(
    points.map((p) => p.time),
    [60, 120, 180],
  );
  assert.equal(points[0]!.value, 1);
  assert.equal(points[1]!.value, 2);
  assert.equal(points[2]!.value, 3);
});

test("accumulate stops on a short final page without duplicating", () => {
  const acc: { bucket_unix: number; close: number }[] = [];
  accumulateCryptoMinuteBarPages(acc, [
    { bucket_unix: 60, close: 1 },
    { bucket_unix: 120, close: 2 },
  ]);
  const again = accumulateCryptoMinuteBarPages(acc, [{ bucket_unix: 120, close: 99 }]);
  assert.equal(again.done, true);
  const points = mapCryptoMinuteBarRows(again.rows);
  assert.equal(points.length, 2);
  assert.equal(points[1]!.value, 2);
});
