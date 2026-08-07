import "server-only";

import { performance } from "node:perf_hooks";

import {
  getLatest13fFilingHeadCached,
  thirteenFilingHeadCacheKey,
  cikPad10,
} from "@/lib/superinvestors/superinvestor-13f-freshness";
import {
  readSuperinvestorFullTransactionsSnapshotLatestSlim,
  readSuperinvestorFullTransactionsSnapshotSlim,
  upsertSuperinvestorFullTransactionsSnapshot,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import {
  expandSuperinvestorTransactionsPayload,
  slimSuperinvestorTransactionsForApi,
  slimSuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/superinvestor-13f-transactions-slim";
import { isSuperinvestorSecRebuildAllowed } from "@/lib/superinvestors/superinvestor-sec-rebuild-gate";
import type { SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";

export type SuperinvestorFullTransactionsLoadMeta = {
  cache: "hit" | "miss" | "stale";
  totalMs: number;
  readMs: number;
  buildMs: number;
  persistMs: number;
  payloadBytes: number;
};

const lastLoadMeta = new Map<string, SuperinvestorFullTransactionsLoadMeta>();

export function peekSuperinvestorFullTransactionsLoadMeta(
  cik: string,
): SuperinvestorFullTransactionsLoadMeta | null {
  return lastLoadMeta.get(cikPad10(cik)) ?? null;
}

function unavailablePayload(cikPadded: string): SuperinvestorTransactionsPayload {
  return {
    filerDisplayName: "Institutional investment manager",
    cik: cikPadded,
    quarters: [],
    source: "unavailable",
  };
}

/**
 * Durable full 13F transaction history (~85 filings).
 * User/API warm path: latest market_snapshot only — never SEC.
 * Cron/ops (inside {@link withSuperinvestorSecRebuildAllowed}): head probe + rebuild + upsert.
 */
export async function loadSuperinvestorFullTransactions(
  cik: string,
  fetchUncached: () => Promise<SuperinvestorTransactionsPayload>,
): Promise<SuperinvestorTransactionsPayload> {
  const paddedCik = cikPad10(cik);
  const started = performance.now();
  let readMs = 0;
  let buildMs = 0;
  let persistMs = 0;
  let cache: SuperinvestorFullTransactionsLoadMeta["cache"] = "miss";

  const allowSec = isSuperinvestorSecRebuildAllowed();

  if (!allowSec) {
    const readStarted = performance.now();
    const cached = await readSuperinvestorFullTransactionsSnapshotLatestSlim(paddedCik);
    readMs = performance.now() - readStarted;
    if (cached) {
      cache = "hit";
      const totalMs = performance.now() - started;
      const payloadBytes = JSON.stringify(cached).length;
      lastLoadMeta.set(paddedCik, { cache, totalMs, readMs, buildMs, persistMs, payloadBytes });
      return cached as unknown as SuperinvestorTransactionsPayload;
    }
    const unavailable = unavailablePayload(paddedCik);
    const totalMs = performance.now() - started;
    lastLoadMeta.set(paddedCik, {
      cache: "miss",
      totalMs,
      readMs,
      buildMs,
      persistMs,
      payloadBytes: JSON.stringify(unavailable).length,
    });
    return unavailable;
  }

  const head = await getLatest13fFilingHeadCached(paddedCik);
  const accKey = thirteenFilingHeadCacheKey(head);

  if (accKey !== "none") {
    const readStarted = performance.now();
    const cached = await readSuperinvestorFullTransactionsSnapshotSlim(paddedCik, accKey);
    readMs = performance.now() - readStarted;
    if (cached) {
      cache = "hit";
      const totalMs = performance.now() - started;
      const payloadBytes = JSON.stringify(cached).length;
      lastLoadMeta.set(paddedCik, { cache, totalMs, readMs, buildMs, persistMs, payloadBytes });
      return cached as unknown as SuperinvestorTransactionsPayload;
    }
    cache = "stale";
  } else {
    const latest = await readSuperinvestorFullTransactionsSnapshotLatestSlim(paddedCik);
    if (latest) {
      cache = "hit";
      const totalMs = performance.now() - started;
      const payloadBytes = JSON.stringify(latest).length;
      lastLoadMeta.set(paddedCik, { cache, totalMs, readMs, buildMs, persistMs, payloadBytes });
      return latest as unknown as SuperinvestorTransactionsPayload;
    }
  }

  const buildStarted = performance.now();
  const built = await fetchUncached();
  buildMs = performance.now() - buildStarted;

  if (built.source === "edgar" && accKey !== "none") {
    const persistStarted = performance.now();
    const slim = slimSuperinvestorTransactionsPayload(built);
    await upsertSuperinvestorFullTransactionsSnapshot(paddedCik, accKey, slim);
    persistMs = performance.now() - persistStarted;
    cache = cache === "stale" ? "stale" : "miss";
  }

  const apiPayload =
    built.source === "edgar" ? slimSuperinvestorTransactionsForApi(built) : built;
  const totalMs = performance.now() - started;
  const payloadBytes = JSON.stringify(apiPayload).length;
  lastLoadMeta.set(paddedCik, { cache, totalMs, readMs, buildMs, persistMs, payloadBytes });

  return apiPayload as unknown as SuperinvestorTransactionsPayload;
}

/** Expand slim snapshot payload to in-memory full shape (profile SSR helpers). */
export function expandFullTransactionsIfNeeded(
  payload: SuperinvestorTransactionsPayload,
): SuperinvestorTransactionsPayload {
  return expandSuperinvestorTransactionsPayload(
    payload as unknown as Parameters<typeof expandSuperinvestorTransactionsPayload>[0],
  );
}
