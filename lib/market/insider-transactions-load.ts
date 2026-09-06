/**
 * Insider transactions load path: snapshot-first (1Y), single-flight cold miss → upsert.
 */
import "server-only";

import {
  ASSET_REBUILD_WAITER_POLL_MS,
  failAssetRebuildLease,
  newAssetRebuildLeaseOwner,
  releaseAssetRebuildLease,
  sleepMs,
  tryAcquireAssetRebuildLease,
} from "@/lib/market/asset-rebuild-lease";
import { runColdMissSingleFlight } from "@/lib/market/asset-rebuild-single-flight";
import {
  fetchEodhdInsiderTransactions,
  fetchEodhdInsiderTransactionsUncached,
  isCanonicalInsider1YRequest,
  resolveInsiderQueryWindow,
  type FetchInsiderTransactionsOpts,
} from "@/lib/market/eodhd-insider-transactions";
import {
  INSIDER_FORM4_1Y_SEGMENT,
  insiderForm4_1ySnapshotKey,
  insiderSnapshotIsFresh,
  isUsableInsiderTransactionsSnapshot,
  readInsiderTransactionsSnapshot,
  upsertInsiderTransactionsSnapshot,
  type InsiderTransactionsSnapshot,
} from "@/lib/market/insider-transactions-snapshot";

/** Form4 can take multiple sequential pages — longer than equity SSR lease. */
const INSIDER_REBUILD_LEASE_TTL_SEC = 120;
const INSIDER_REBUILD_WAITER_MAX_MS = 45_000;

export type InsiderTransactionsPayload = {
  ticker: string;
  rows: InsiderTransactionsSnapshot["rows"];
  windowFrom: string;
  windowTo: string;
  source: "snapshot" | "provider";
};

type InsiderHit = { payload: InsiderTransactionsSnapshot; updatedAt: string };

function payloadFromSnapshot(
  ticker: string,
  snap: InsiderTransactionsSnapshot,
  source: "snapshot" | "provider",
): InsiderTransactionsPayload {
  return {
    ticker,
    rows: snap.rows,
    windowFrom: snap.windowFrom,
    windowTo: snap.windowTo,
    source,
  };
}

async function rebuildInsider1YUncached(
  ticker: string,
  limit?: number,
): Promise<InsiderTransactionsPayload> {
  const { from, to } = resolveInsiderQueryWindow();
  const rows = await fetchEodhdInsiderTransactionsUncached(ticker, { from, to, limit });
  return {
    ticker,
    rows,
    windowFrom: from,
    windowTo: to,
    source: "provider",
  };
}

export async function loadInsiderTransactionsForTicker(
  listingTicker: string,
  opts?: FetchInsiderTransactionsOpts & { forceRefresh?: boolean },
): Promise<InsiderTransactionsPayload> {
  const ticker = listingTicker.trim().toUpperCase();
  const canonical = isCanonicalInsider1YRequest({ from: opts?.from, to: opts?.to });
  const { from, to } = resolveInsiderQueryWindow({ from: opts?.from, to: opts?.to });

  if (canonical && !opts?.forceRefresh) {
    const hit = await readInsiderTransactionsSnapshot(ticker);
    if (hit) {
      return payloadFromSnapshot(ticker, hit.payload, "snapshot");
    }
  }

  // Custom from/to — no durable 1Y snapshot key; use short unstable_cache path only.
  if (!canonical) {
    const rows = await fetchEodhdInsiderTransactions(ticker, {
      from,
      to,
      limit: opts?.limit,
    });
    return { ticker, rows, windowFrom: from, windowTo: to, source: "provider" };
  }

  // Cron / explicit rebuild — always provider, then upsert (no waiter path needed).
  if (opts?.forceRefresh) {
    const fresh = await rebuildInsider1YUncached(ticker, opts?.limit);
    await upsertInsiderTransactionsSnapshot(ticker, {
      ticker,
      rows: fresh.rows,
      windowFrom: fresh.windowFrom,
      windowTo: fresh.windowTo,
    });
    return fresh;
  }

  const snapKey = insiderForm4_1ySnapshotKey(ticker);
  if (!snapKey) {
    const fresh = await rebuildInsider1YUncached(ticker, opts?.limit);
    return fresh;
  }

  const page = await runColdMissSingleFlight<InsiderTransactionsPayload, InsiderHit>({
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(snapKey, INSIDER_FORM4_1Y_SEGMENT, ownerId, INSIDER_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(snapKey, INSIDER_FORM4_1Y_SEGMENT, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(snapKey, INSIDER_FORM4_1Y_SEGMENT, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: async () => rebuildInsider1YUncached(ticker, opts?.limit),
    persistSnapshot: async (fresh) => {
      const res = await upsertInsiderTransactionsSnapshot(ticker, {
        ticker,
        rows: fresh.rows,
        windowFrom: fresh.windowFrom,
        windowTo: fresh.windowTo,
      });
      return res.ok ? { ok: true } : { ok: false, reason: res.reason };
    },
    readSnapshot: () => readInsiderTransactionsSnapshot(ticker),
    isUsableHit: (hit) =>
      hit != null && isUsableInsiderTransactionsSnapshot(hit.payload, ticker),
    pageFromSnapshot: async (hit) => payloadFromSnapshot(ticker, hit.payload, "snapshot"),
    fallbackPage: () => ({
      ticker,
      rows: [],
      windowFrom: from,
      windowTo: to,
      source: "provider",
    }),
    sleep: sleepMs,
    now: () => Date.now(),
    waiterMaxMs: INSIDER_REBUILD_WAITER_MAX_MS,
    pollMs: ASSET_REBUILD_WAITER_POLL_MS,
  });

  return (
    page ?? {
      ticker,
      rows: [],
      windowFrom: from,
      windowTo: to,
      source: "provider",
    }
  );
}

/**
 * Weekday warm: refresh when missing or stale. Returns whether provider was called.
 */
export async function warmInsiderTransactionsSnapshot(
  listingTicker: string,
): Promise<{ ok: boolean; skippedFresh: boolean; rowCount: number }> {
  const ticker = listingTicker.trim().toUpperCase();
  const hit = await readInsiderTransactionsSnapshot(ticker);
  if (hit && insiderSnapshotIsFresh(hit.updatedAt)) {
    return { ok: true, skippedFresh: true, rowCount: hit.payload.rows.length };
  }

  const payload = await loadInsiderTransactionsForTicker(ticker, { forceRefresh: true });
  return { ok: true, skippedFresh: false, rowCount: payload.rows.length };
}
