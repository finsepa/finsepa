/**
 * Shared client fetch for Modified Dietz period returns.
 * Dedupes in-flight requests and caches by ledger fingerprint so Overview cards
 * and Allocation donut share one canonical result.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export type DietzPeriodClientSlice = {
  pct: number | null;
  gainUsd: number | null;
};

type DietzPeriodsPayload = {
  periods?: Partial<Record<string, DietzPeriodClientSlice>>;
};

const TTL_MS = 60_000;
const cache = new Map<
  string,
  { at: number; periods: Record<string, DietzPeriodClientSlice> }
>();
const inflight = new Map<string, Promise<Record<string, DietzPeriodClientSlice>>>();

/** Cheap stable fingerprint — enough to invalidate when economics change. */
export function dietzClientLedgerFingerprint(transactions: readonly PortfolioTransaction[]): string {
  let h = transactions.length;
  for (const t of transactions) {
    h = (Math.imul(h, 31) + t.date.length) | 0;
    h = (Math.imul(h, 31) + (t.id?.length ?? 0)) | 0;
    h = (Math.imul(h, 31) + (t.sum * 1000) | 0) | 0;
    h = (Math.imul(h, 31) + (t.shares * 1e6) | 0) | 0;
    h = (Math.imul(h, 31) + (t.price * 1e4) | 0) | 0;
    h = (Math.imul(h, 31) + (t.sequence ?? 0)) | 0;
  }
  return `n${transactions.length}:${h >>> 0}`;
}

function periodCacheKey(fingerprint: string, periods: readonly string[]): string {
  return `${fingerprint}|${[...periods].sort().join(",")}`;
}

/**
 * Fetch Dietz slices for the requested periods. Reuses cache / in-flight work for the
 * same ledger fingerprint. Missing periods are fetched and merged into the cache entry.
 */
export async function fetchPortfolioDietzReturnsClient(
  transactions: readonly PortfolioTransaction[],
  periods: readonly string[],
): Promise<Record<string, DietzPeriodClientSlice>> {
  if (transactions.length === 0 || periods.length === 0) return {};

  const fingerprint = dietzClientLedgerFingerprint(transactions);
  const uniquePeriods = [...new Set(periods)];
  const now = Date.now();

  const entry = cache.get(fingerprint);
  if (entry && now - entry.at < TTL_MS) {
    const missing = uniquePeriods.filter((p) => entry.periods[p] === undefined);
    if (missing.length === 0) {
      const out: Record<string, DietzPeriodClientSlice> = {};
      for (const p of uniquePeriods) out[p] = entry.periods[p]!;
      return out;
    }
  }

  const need =
    entry && now - entry.at < TTL_MS
      ? uniquePeriods.filter((p) => entry.periods[p] === undefined)
      : uniquePeriods;

  const key = periodCacheKey(fingerprint, need);
  let promise = inflight.get(key);
  if (!promise) {
    promise = (async () => {
      const res = await fetch("/api/portfolio/dietz-returns", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, periods: need }),
      });
      if (!res.ok) throw new Error(`dietz-returns ${res.status}`);
      const data = (await res.json()) as DietzPeriodsPayload;
      const fetched: Record<string, DietzPeriodClientSlice> = {};
      for (const p of need) {
        const row = data.periods?.[p];
        if (row) fetched[p] = { pct: row.pct, gainUsd: row.gainUsd };
        else fetched[p] = { pct: null, gainUsd: null };
      }
      return fetched;
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
  }

  const fetched = await promise;
  const prev = cache.get(fingerprint);
  const merged = {
    ...(prev && now - prev.at < TTL_MS ? prev.periods : {}),
    ...fetched,
  };
  cache.set(fingerprint, { at: Date.now(), periods: merged });

  const out: Record<string, DietzPeriodClientSlice> = {};
  for (const p of uniquePeriods) {
    out[p] = merged[p] ?? { pct: null, gainUsd: null };
  }
  return out;
}

/** Test / cert helper — clear client Dietz cache. */
export function clearPortfolioDietzReturnsClientCache(): void {
  cache.clear();
  inflight.clear();
}
