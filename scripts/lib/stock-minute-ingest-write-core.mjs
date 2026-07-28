/**
 * Single-flight stock minute-bar write controller.
 *
 * Hot pending + retry queue stay separate, but at most one Supabase upsert is in flight.
 * Drain policy per cycle: one eligible retry batch, then one hot batch (sequential under one gate).
 */

/** @typedef {{ ticker: string, session_ymd: string, bucket_unix: number, close: number, updated_at: string }} MinuteBarRow */

/**
 * @param {MinuteBarRow | null | undefined} a
 * @param {MinuteBarRow | null | undefined} b
 * @returns {MinuteBarRow | null | undefined}
 */
export function pickLatestMinuteRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.updated_at >= b.updated_at ? a : b;
}

export function minuteBarKey(row) {
  return `${row.ticker}:${row.bucket_unix}`;
}

export function isTransientUpsertFailure(message) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("522") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("abort") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

export function flushBackoffMs(attempt, message = "") {
  const base = isTransientUpsertFailure(message)
    ? Math.min(60_000, 1_000 * 2 ** attempt)
    : Math.min(8_000, 400 * 2 ** attempt);
  return base;
}

/**
 * Strip controller-only fields before upsert.
 * @param {MinuteBarRow & { queuedAtMs?: number }} row
 * @returns {MinuteBarRow}
 */
export function toUpsertRow(row) {
  return {
    ticker: row.ticker,
    session_ymd: row.session_ymd,
    bucket_unix: row.bucket_unix,
    close: row.close,
    updated_at: row.updated_at,
  };
}

/**
 * @param {{
 *   upsertChunk: (rows: MinuteBarRow[]) => Promise<void>,
 *   chunkSize?: number,
 *   maxRowsPerCycle?: number,
 *   pendingCap?: number,
 *   now?: () => number,
 *   log?: (...args: unknown[]) => void,
 *   assert?: (cond: boolean, msg: string) => void,
 *   onWatchFlushDone?: () => void,
 * }} opts
 */
export function createStockMinuteWriteController(opts) {
  const upsertChunk = opts.upsertChunk;
  const chunkSize = Math.max(1, opts.chunkSize ?? 15);
  const maxRowsPerCycle = Math.max(1, opts.maxRowsPerCycle ?? 100);
  const pendingCap = Math.max(1, opts.pendingCap ?? 600);
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? (() => {});
  const assertInvariant =
    opts.assert ??
    ((cond, msg) => {
      if (!cond) throw new Error(msg);
    });

  /** @type {Map<string, MinuteBarRow & { queuedAtMs: number }>} */
  const pendingUpserts = new Map();
  /**
   * @type {Map<string, {
   *   row: MinuteBarRow & { queuedAtMs?: number },
   *   attempt: number,
   *   nextAt: number,
   *   queuedAtMs: number,
   * }>}
   */
  const retryQueue = new Map();

  let writeInProgress = false;
  let activeSupabaseUpserts = 0;
  let maxObservedConcurrentUpserts = 0;
  /** @type {"hot" | "retry" | null} */
  let currentWriteSource = null;
  let flushStartedAtMs = null;
  let consecutiveWriteFailures = 0;
  let currentBackoffMs = 0;
  let nextAllowedWriteAtMs = 0;
  let pendingDropCount = 0;
  let upsertSuccessCount = 0;
  let upsertAbortCount = 0;
  let retryCount = 0;
  /** @type {number | null} */
  let lastSuccessfulUpsertMs = null;
  /** @type {string | null} */
  let lastSuccessfulUpsertAt = null;
  /** @type {string | null} */
  let lastFailedUpsertAt = null;
  /** @type {number | null} */
  let lastUpsertLatencyMs = null;
  const startedAtMs = now();

  let wakeTimer = null;
  let wakeImmediateScheduled = false;
  /** @type {(() => void) | null} */
  let onCycleIdle = null;

  function setOnCycleIdle(fn) {
    onCycleIdle = typeof fn === "function" ? fn : null;
  }

  function oldestAgeMs(map, getQueuedAt) {
    if (map.size === 0) return 0;
    const t = now();
    let oldest = t;
    for (const entry of map.values()) {
      const q = getQueuedAt(entry);
      if (Number.isFinite(q) && q < oldest) oldest = q;
    }
    return Math.max(0, t - oldest);
  }

  function computeWriteStallSeconds() {
    if (pendingUpserts.size === 0 && retryQueue.size === 0) return 0;
    const anchor = lastSuccessfulUpsertMs ?? startedAtMs;
    return Math.max(0, Math.floor((now() - anchor) / 1000));
  }

  function snapshotHealth() {
    return {
      flushInProgress: writeInProgress,
      currentWriteSource,
      activeSupabaseUpserts,
      maxObservedConcurrentUpserts,
      pendingUpserts: pendingUpserts.size,
      retryQueueSize: retryQueue.size,
      upsertSuccessCount,
      upsertAbortCount,
      retryCount,
      consecutiveWriteFailures,
      lastSuccessfulUpsertAt,
      lastFailedUpsertAt,
      lastUpsertLatencyMs,
      currentBackoffMs,
      pendingDropCount,
      oldestPendingAgeMs: oldestAgeMs(pendingUpserts, (r) => r.queuedAtMs),
      oldestRetryAgeMs: oldestAgeMs(retryQueue, (e) => e.queuedAtMs),
      writeStallSeconds: computeWriteStallSeconds(),
      flushStartedAt: flushStartedAtMs != null ? new Date(flushStartedAtMs).toISOString() : null,
      nextAllowedWriteAtMs,
    };
  }

  function assertOwnershipInvariant() {
    for (const key of pendingUpserts.keys()) {
      assertInvariant(!retryQueue.has(key), `key in both pending and retry: ${key}`);
    }
  }

  /**
   * Hot path enqueue. Merges into pending and removes retry ownership for the same key.
   * @param {MinuteBarRow} row
   * @returns {{ accepted: boolean, dropped: boolean }}
   */
  function enqueuePending(row) {
    const key = minuteBarKey(row);
    const t = now();

    if (pendingUpserts.size >= pendingCap && !pendingUpserts.has(key) && !retryQueue.has(key)) {
      pendingDropCount += 1;
      log("pending drop", key, "cap", pendingCap, "pendingDropCount", pendingDropCount);
      return { accepted: false, dropped: true };
    }

    const retryEntry = retryQueue.get(key);
    const merged = pickLatestMinuteRow(
      pickLatestMinuteRow(toUpsertRow(row), pendingUpserts.get(key)),
      retryEntry?.row ? toUpsertRow(retryEntry.row) : null,
    );
    if (!merged) return { accepted: false, dropped: false };

    const queuedAtMs =
      pendingUpserts.get(key)?.queuedAtMs ?? retryEntry?.queuedAtMs ?? t;

    if (retryEntry) retryQueue.delete(key);

    pendingUpserts.set(key, { ...toUpsertRow(merged), queuedAtMs });
    assertOwnershipInvariant();
    return { accepted: true, dropped: false };
  }

  function hasEligibleRetry(at = now()) {
    for (const [key, entry] of retryQueue) {
      if (entry.nextAt > at) continue;
      if (pendingUpserts.has(key)) continue;
      return true;
    }
    return false;
  }

  function hasWork(at = now()) {
    return pendingUpserts.size > 0 || hasEligibleRetry(at) || retryQueue.size > 0;
  }

  function collectEligibleRetryRows(at = now()) {
    /** @type {MinuteBarRow[]} */
    const due = [];
    for (const [key, entry] of retryQueue) {
      if (entry.nextAt > at) continue;
      if (pendingUpserts.has(key)) {
        // Hot owns latest — drop stale retry ownership.
        retryQueue.delete(key);
        continue;
      }
      due.push({ ...toUpsertRow(entry.row), queuedAtMs: entry.queuedAtMs });
      if (due.length >= maxRowsPerCycle) break;
    }
    return due;
  }

  function takePendingRows() {
    /** @type {(MinuteBarRow & { queuedAtMs: number })[]} */
    const rows = [];
    for (const [key, row] of pendingUpserts) {
      if (rows.length >= maxRowsPerCycle) break;
      rows.push(row);
      pendingUpserts.delete(key);
    }
    return rows;
  }

  function recordSuccess(latencyMs) {
    lastSuccessfulUpsertMs = now();
    lastSuccessfulUpsertAt = new Date(lastSuccessfulUpsertMs).toISOString();
    lastUpsertLatencyMs = latencyMs;
    upsertSuccessCount += 1;
    consecutiveWriteFailures = 0;
    currentBackoffMs = 0;
    nextAllowedWriteAtMs = 0;
  }

  function recordFailure(message, latencyMs) {
    lastFailedUpsertAt = new Date(now()).toISOString();
    lastUpsertLatencyMs = latencyMs;
    if (String(message ?? "").toLowerCase().includes("abort")) {
      upsertAbortCount += 1;
    }
    consecutiveWriteFailures += 1;
  }

  function enqueueRetryRows(rows, errMsg) {
    const t = now();
    for (const row of rows) {
      const key = minuteBarKey(row);
      if (pendingUpserts.has(key)) {
        // Hot already has a newer owner for this key.
        retryQueue.delete(key);
        continue;
      }
      const existing = retryQueue.get(key);
      const latest = pickLatestMinuteRow(toUpsertRow(row), existing?.row ? toUpsertRow(existing.row) : null);
      if (!latest) continue;
      const attempt = (existing?.attempt ?? -1) + 1;
      const backoff = flushBackoffMs(attempt, errMsg);
      currentBackoffMs = backoff;
      nextAllowedWriteAtMs = Math.max(nextAllowedWriteAtMs, t + backoff);
      retryQueue.set(key, {
        row: { ...latest, queuedAtMs: existing?.queuedAtMs ?? row.queuedAtMs ?? t },
        attempt,
        nextAt: t + backoff,
        queuedAtMs: existing?.queuedAtMs ?? row.queuedAtMs ?? t,
      });
    }
    assertOwnershipInvariant();
  }

  function putPendingRowsBack(rows) {
    const t = now();
    for (const row of rows) {
      const key = minuteBarKey(row);
      const existing = pendingUpserts.get(key);
      const merged = pickLatestMinuteRow(toUpsertRow(row), existing);
      if (!merged) continue;
      // Prefer pending ownership over retry.
      retryQueue.delete(key);
      pendingUpserts.set(key, {
        ...toUpsertRow(merged),
        queuedAtMs: existing?.queuedAtMs ?? row.queuedAtMs ?? t,
      });
    }
    assertOwnershipInvariant();
  }

  /**
   * @param {MinuteBarRow[]} rows
   * @param {"hot" | "retry"} source
   */
  async function writeRowsSequential(rows, source) {
    if (!rows.length) return;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map(toUpsertRow);
      const keys = chunk.map(minuteBarKey);
      const started = now();

      assertInvariant(activeSupabaseUpserts === 0, "write gate violated before upsert");
      activeSupabaseUpserts += 1;
      maxObservedConcurrentUpserts = Math.max(maxObservedConcurrentUpserts, activeSupabaseUpserts);
      assertInvariant(activeSupabaseUpserts === 1, "activeSupabaseUpserts must be 1");
      assertInvariant(
        maxObservedConcurrentUpserts <= 1,
        "maxObservedConcurrentUpserts exceeded 1",
      );

      currentWriteSource = source;
      if (source === "retry") retryCount += 1;

      try {
        await upsertChunk(chunk);
        recordSuccess(now() - started);
        for (const key of keys) retryQueue.delete(key);
        log("upserted", chunk.length, "minute bars", source === "retry" ? "(retry)" : "");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        recordFailure(msg, now() - started);
        log("upsert error", msg, "rows", chunk.length, source);

        const failed = rows.slice(i).map((r) => ({
          ...toUpsertRow(r),
          queuedAtMs: r.queuedAtMs,
        }));
        const remainingUntouched = [];

        if (isTransientUpsertFailure(msg)) {
          enqueueRetryRows(failed, msg);
        } else if (source === "hot") {
          putPendingRowsBack(failed);
        } else {
          enqueueRetryRows(failed, msg);
        }

        // Do not continue remaining chunks after a failure — preserve + backoff.
        void remainingUntouched;
        return;
      } finally {
        activeSupabaseUpserts = Math.max(0, activeSupabaseUpserts - 1);
        assertInvariant(activeSupabaseUpserts === 0, "activeSupabaseUpserts leak");
      }
    }
  }

  async function runWriteCycle() {
    if (writeInProgress) return;
    if (activeSupabaseUpserts !== 0) return;

    const t = now();
    if (t < nextAllowedWriteAtMs) {
      scheduleWake(nextAllowedWriteAtMs - t);
      return;
    }

    const retryRows = collectEligibleRetryRows(t);
    const canHot = pendingUpserts.size > 0;
    if (!retryRows.length && !canHot) return;

    writeInProgress = true;
    flushStartedAtMs = t;
    try {
      // Policy: one retry batch, then one hot batch, under the same gate (sequential HTTP).
      if (retryRows.length) {
        // Remove from retry before write so ownership is clear; failures re-enqueue.
        for (const row of retryRows) retryQueue.delete(minuteBarKey(row));
        await writeRowsSequential(retryRows, "retry");
      }

      if (pendingUpserts.size > 0 && activeSupabaseUpserts === 0) {
        // If retry just failed and set backoff, skip hot until backoff elapses.
        if (now() >= nextAllowedWriteAtMs) {
          const hotRows = takePendingRows();
          await writeRowsSequential(hotRows, "hot");
        }
      }
    } finally {
      writeInProgress = false;
      currentWriteSource = null;
      flushStartedAtMs = null;
      if (typeof onCycleIdle === "function") {
        try {
          onCycleIdle();
        } catch {
          /* ignore */
        }
      }
      if (hasWork()) {
        const delay =
          now() < nextAllowedWriteAtMs ? Math.max(0, nextAllowedWriteAtMs - now()) : 0;
        scheduleWake(delay);
      }
    }
  }

  /**
   * Collapse duplicate wake-ups. Never starts a second concurrent cycle.
   * @param {number} [delayMs]
   */
  function scheduleWake(delayMs = 0) {
    if (writeInProgress) return;

    const wait = Math.max(0, delayMs);
    if (wait === 0) {
      if (wakeTimer) {
        clearTimeout(wakeTimer);
        wakeTimer = null;
      }
      if (wakeImmediateScheduled) return;
      wakeImmediateScheduled = true;
      setImmediate(() => {
        wakeImmediateScheduled = false;
        void runWriteCycle();
      });
      return;
    }

    if (wakeImmediateScheduled) return;
    if (wakeTimer) return;
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      void runWriteCycle();
    }, wait);
  }

  /** Debounced / urgent / periodic hot scheduling entrypoint. */
  function requestHotFlush({ urgent = false, debounceMs = 1_500 } = {}) {
    if (writeInProgress) return;
    if (pendingUpserts.size === 0 && !hasEligibleRetry()) return;
    if (urgent) {
      scheduleWake(0);
      return;
    }
    scheduleWake(debounceMs);
  }

  /** Retry tick / periodic entrypoint — same gate. */
  function requestRetryFlush() {
    if (writeInProgress) return;
    const t = now();
    if (t < nextAllowedWriteAtMs) {
      scheduleWake(nextAllowedWriteAtMs - t);
      return;
    }
    scheduleWake(0);
  }

  async function flushNow() {
    // Used on shutdown: wait for gate then drain.
    while (writeInProgress) {
      await new Promise((r) => setImmediate(r));
    }
    nextAllowedWriteAtMs = 0;
    await runWriteCycle();
    // One more pass if hot arrived during retry.
    if (hasWork() && !writeInProgress) {
      await runWriteCycle();
    }
  }

  function dispose() {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    wakeImmediateScheduled = false;
    nextAllowedWriteAtMs = 0;
  }

  return {
    pendingUpserts,
    retryQueue,
    enqueuePending,
    requestHotFlush,
    requestRetryFlush,
    scheduleWake,
    flushNow,
    runWriteCycle,
    snapshotHealth,
    setOnCycleIdle,
    assertOwnershipInvariant,
    dispose,
    // test helpers
    _internals: {
      get writeInProgress() {
        return writeInProgress;
      },
      get activeSupabaseUpserts() {
        return activeSupabaseUpserts;
      },
      get maxObservedConcurrentUpserts() {
        return maxObservedConcurrentUpserts;
      },
      collectEligibleRetryRows,
      takePendingRows,
      enqueueRetryRows,
      putPendingRowsBack,
      clearBackoff() {
        nextAllowedWriteAtMs = 0;
        for (const e of retryQueue.values()) e.nextAt = 0;
      },
    },
  };
}
