import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";

const INTRADAY_RANGES = new Set<PortfolioChartRange>(["1d", "5d", "1m"]);

type CacheEntry = {
  at: number;
  points: PortfolioValueHistoryPoint[];
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PortfolioValueHistoryPoint[]>>();

/** Stable ledger fingerprint for in-tab value-history reuse (Overview ↔ Performance). */
export function portfolioValueHistoryLedgerKey(transactions: readonly PortfolioTransaction[]): string {
  if (!transactions.length) return "empty";
  const parts = transactions.map(
    (t) =>
      `${t.id}\u001f${t.date}\u001f${t.kind}\u001f${t.operation}\u001f${t.symbol}\u001f${t.shares}\u001f${t.sum}\u001f${t.sequence ?? ""}`,
  );
  parts.sort();
  let hash = 0;
  const joined = parts.join("\u001e");
  for (let i = 0; i < joined.length; i++) {
    hash = ((hash << 5) - hash + joined.charCodeAt(i)) | 0;
  }
  return `${transactions.length}:${hash.toString(36)}`;
}

export function portfolioValueHistoryCacheKey(
  range: PortfolioChartRange,
  transactions: readonly PortfolioTransaction[],
): string {
  return `${range}|${portfolioValueHistoryLedgerKey(transactions)}`;
}

function cacheTtlMs(range: PortfolioChartRange): number {
  return INTRADAY_RANGES.has(range) ? 60_000 : 5 * 60_000;
}

async function fetchPortfolioValueHistoryPayload(
  range: PortfolioChartRange,
  transactions: readonly PortfolioTransaction[],
  signal?: AbortSignal,
): Promise<PortfolioValueHistoryPoint[]> {
  const res = await fetch("/api/portfolio/value-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal,
    body: JSON.stringify({ range, transactions }),
  });
  if (!res.ok) throw new Error("Failed to load chart");
  const json = (await res.json()) as { points?: PortfolioValueHistoryPoint[] };
  return Array.isArray(json.points) ? json.points : [];
}

/** Drop cached computed history (e.g. after explicit portfolio rebuild). */
export function invalidatePortfolioValueHistoryCache(): void {
  cache.clear();
  inflight.clear();
}

/** Sync cache read — `null` means this range is not loaded yet. */
export function peekPortfolioValueHistoryCached(
  range: PortfolioChartRange,
  transactions: readonly PortfolioTransaction[],
): PortfolioValueHistoryPoint[] | null {
  if (!transactions.length) return [];
  const key = portfolioValueHistoryCacheKey(range, transactions);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheTtlMs(range)) return hit.points;
  return null;
}

/**
 * Dedupes portfolio value-history POSTs across Overview + Performance for the same
 * `(range, ledger)` within a short TTL — avoids repeat intraday EODHD work.
 */
function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

export async function fetchPortfolioValueHistoryCached(
  range: PortfolioChartRange,
  transactions: readonly PortfolioTransaction[],
  signal?: AbortSignal,
): Promise<PortfolioValueHistoryPoint[]> {
  if (!transactions.length) return [];
  throwIfAborted(signal);

  const key = portfolioValueHistoryCacheKey(range, transactions);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheTtlMs(range)) {
    return hit.points;
  }

  const pending = inflight.get(key);
  if (pending) {
    const points = await pending;
    throwIfAborted(signal);
    return points;
  }

  const p = (async () => {
    // Shared in-flight must not bind to one caller's AbortSignal — Overview and
    // Insights join the same promise; aborting one must not fail the other.
    let points = await fetchPortfolioValueHistoryPayload(range, transactions);
    // One retry: empty history with an active ledger is usually a transient provider gap.
    if (points.length === 0 && transactions.length > 0) {
      points = await fetchPortfolioValueHistoryPayload(range, transactions);
    }
    cache.set(key, { at: Date.now(), points });
    return points;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  const points = await p;
  throwIfAborted(signal);
  return points;
}
