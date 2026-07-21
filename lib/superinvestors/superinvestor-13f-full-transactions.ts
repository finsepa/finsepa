import "server-only";

import { performance } from "node:perf_hooks";

import {
  getLatest13fFilingHeadCached,
  thirteenFilingHeadCacheKey,
  cikPad10,
} from "@/lib/superinvestors/superinvestor-13f-freshness";
import {
  readSuperinvestorFullTransactionsSnapshotSlim,
  upsertSuperinvestorFullTransactionsSnapshot,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import {
  expandSuperinvestorTransactionsPayload,
  slimSuperinvestorTransactionsForApi,
  slimSuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/superinvestor-13f-transactions-slim";
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

/**
 * Durable full 13F transaction history (~85 filings). Warm path: read market_snapshot → return JSON.
 * Cold path: SEC rebuild → slim persist → return.
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
