import assert from "node:assert/strict";
import test from "node:test";

import {
  createStockMinuteWriteController,
  minuteBarKey,
  pickLatestMinuteRow,
} from "./stock-minute-ingest-write-core.mjs";

function row(ticker, bucket, close, updatedAt, session = "2026-07-27") {
  return {
    ticker,
    session_ymd: session,
    bucket_unix: bucket,
    close,
    updated_at: updatedAt,
  };
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function settle() {
  for (let i = 0; i < 15; i++) await wait(0);
}

test("hot and retry triggered together produce only one active Supabase request", async () => {
  let active = 0;
  let maxActive = 0;
  /** @type {unknown[][]} */
  const calls = [];

  const ctrl = createStockMinuteWriteController({
    chunkSize: 15,
    maxRowsPerCycle: 100,
    upsertChunk: async (chunk) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push(chunk);
      await wait(20);
      active -= 1;
    },
  });

  try {
    ctrl.enqueuePending(row("AAPL", 100, 1, "2026-07-27T17:00:00.000Z"));
    ctrl._internals.enqueueRetryRows([row("NVDA", 100, 2, "2026-07-27T17:00:00.000Z")], "abort");
    ctrl._internals.clearBackoff();

    ctrl.requestHotFlush({ urgent: true });
    ctrl.requestRetryFlush();
    ctrl.requestHotFlush({ urgent: true });

    await wait(100);
    await settle();
    await ctrl.flushNow();

    assert.equal(maxActive, 1);
    assert.equal(ctrl.snapshotHealth().maxObservedConcurrentUpserts, 1);
    assert.ok(calls.length >= 1);
  } finally {
    ctrl.dispose();
  }
});

test("retry batch runs first when eligible, then hot", async () => {
  /** @type {string[]} */
  const order = [];
  const ctrl = createStockMinuteWriteController({
    upsertChunk: async (chunk) => {
      order.push(chunk.map((r) => r.ticker).join(","));
      await wait(5);
    },
  });

  try {
    ctrl.enqueuePending(row("AAPL", 200, 10, "2026-07-27T17:01:00.000Z"));
    ctrl._internals.enqueueRetryRows([row("NVDA", 200, 20, "2026-07-27T17:00:00.000Z")], "abort");
    ctrl._internals.clearBackoff();

    await ctrl.flushNow();
    assert.deepEqual(order, ["NVDA", "AAPL"]);
  } finally {
    ctrl.dispose();
  }
});

test("abort releases the shared gate and keeps failed rows queued", async () => {
  let calls = 0;
  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {
      calls += 1;
      await wait(5);
      throw new Error("AbortError: This operation was aborted");
    },
  });

  try {
    ctrl.enqueuePending(row("QQQ", 300, 1, "2026-07-27T17:00:00.000Z"));
    await ctrl.flushNow();

    const snap = ctrl.snapshotHealth();
    assert.equal(snap.flushInProgress, false);
    assert.equal(snap.activeSupabaseUpserts, 0);
    assert.equal(snap.upsertAbortCount, 1);
    assert.equal(snap.retryQueueSize, 1);
    assert.equal(ctrl.pendingUpserts.size, 0);
    assert.ok(calls >= 1);
  } finally {
    ctrl.dispose();
  }
});

test("later successful request drains the retry queue", async () => {
  let failOnce = true;
  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {
      await wait(2);
      if (failOnce) {
        failOnce = false;
        throw new Error("AbortError: This operation was aborted");
      }
    },
  });

  try {
    ctrl.enqueuePending(row("SPY", 400, 1, "2026-07-27T17:00:00.000Z"));
    await ctrl.flushNow();
    assert.equal(ctrl.snapshotHealth().retryQueueSize, 1);

    ctrl._internals.clearBackoff();
    await ctrl.flushNow();

    assert.equal(ctrl.snapshotHealth().retryQueueSize, 0);
    assert.ok(ctrl.snapshotHealth().upsertSuccessCount >= 1);
  } finally {
    ctrl.dispose();
  }
});

test("same ticker+minute across pending and retry coalesces to one latest row", () => {
  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {},
  });

  try {
    ctrl._internals.enqueueRetryRows([row("AAPL", 500, 100, "2026-07-27T17:00:00.000Z")], "abort");
    assert.equal(ctrl.retryQueue.size, 1);

    ctrl.enqueuePending(row("AAPL", 500, 105, "2026-07-27T17:00:05.000Z"));
    assert.equal(ctrl.retryQueue.size, 0);
    assert.equal(ctrl.pendingUpserts.size, 1);
    assert.equal(ctrl.pendingUpserts.get("AAPL:500")?.close, 105);
    ctrl.assertOwnershipInvariant();
  } finally {
    ctrl.dispose();
  }
});

test("urgent flush cannot bypass an active retry write", async () => {
  let active = 0;
  let maxActive = 0;
  /** @type {(() => void) | undefined} */
  let release;
  const gate = new Promise((r) => {
    release = r;
  });

  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gate;
      active -= 1;
    },
  });

  try {
    ctrl._internals.enqueueRetryRows([row("NVDA", 600, 1, "2026-07-27T17:00:00.000Z")], "abort");
    ctrl._internals.clearBackoff();

    const cycle = ctrl.runWriteCycle();
    await wait(15);
    assert.equal(ctrl.snapshotHealth().flushInProgress, true);

    ctrl.enqueuePending(row("AAPL", 601, 2, "2026-07-27T17:00:01.000Z"));
    ctrl.requestHotFlush({ urgent: true });
    await wait(15);

    assert.equal(maxActive, 1);
    assert.equal(ctrl.snapshotHealth().maxObservedConcurrentUpserts, 1);

    release?.();
    await cycle;
    await settle();
    await ctrl.flushNow();
    assert.equal(maxActive, 1);
  } finally {
    release?.();
    ctrl.dispose();
  }
});

test("periodic tick cannot bypass an active hot write", async () => {
  let active = 0;
  let maxActive = 0;
  /** @type {(() => void) | undefined} */
  let release;
  const gate = new Promise((r) => {
    release = r;
  });

  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gate;
      active -= 1;
    },
  });

  try {
    ctrl.enqueuePending(row("QQQ", 700, 1, "2026-07-27T17:00:00.000Z"));
    const cycle = ctrl.runWriteCycle();
    await wait(15);

    ctrl.requestRetryFlush();
    ctrl.requestHotFlush({ urgent: true });
    await wait(15);

    assert.equal(maxActive, 1);
    release?.();
    await cycle;
    await settle();
    assert.equal(ctrl.snapshotHealth().maxObservedConcurrentUpserts, 1);
  } finally {
    release?.();
    ctrl.dispose();
  }
});

test("maxObservedConcurrentUpserts never exceeds 1 across many overlapping wakes", async () => {
  const ctrl = createStockMinuteWriteController({
    upsertChunk: async () => {
      await wait(5);
    },
  });

  try {
    for (let i = 0; i < 20; i++) {
      ctrl.enqueuePending(
        row("SPY", 800 + i, i, `2026-07-27T17:00:${String(i).padStart(2, "0")}.000Z`),
      );
      ctrl.requestHotFlush({ urgent: true });
      ctrl.requestRetryFlush();
    }
    await wait(250);
    await settle();
    await ctrl.flushNow();
    assert.equal(ctrl.snapshotHealth().maxObservedConcurrentUpserts, 1);
  } finally {
    ctrl.dispose();
  }
});

test("pickLatestMinuteRow prefers newer updated_at", () => {
  const a = row("AAPL", 1, 1, "2026-07-27T17:00:00.000Z");
  const b = row("AAPL", 1, 2, "2026-07-27T17:00:01.000Z");
  assert.equal(pickLatestMinuteRow(a, b)?.close, 2);
  assert.equal(minuteBarKey(a), "AAPL:1");
});
