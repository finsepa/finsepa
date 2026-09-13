import type { EodhdTopUniverseRow } from "@/lib/market/eodhd-screener";

export type TopCompanyUniverseRow = EodhdTopUniverseRow;

/**
 * Hide from screener top-500 only (search / stock routes still work via EODHD search).
 * GOOG — Alphabet Class C (list GOOGL). SKHY / SKHYY — OTC ADRs for SK hynix.
 */
const SCREENER_TOP500_EXCLUDED_TICKERS = new Set(["GOOG", "SKHY", "SKHYY"]);

/** Reject tiny/poisoned cron blobs so we fall back to EODHD instead of caching a bad list for 7d. */
export const TOP500_SNAPSHOT_MIN_ROWS = 100;

export function filterScreenerTop500ExcludedTickers<T extends { ticker: string }>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => !SCREENER_TOP500_EXCLUDED_TICKERS.has(r.ticker.trim().toUpperCase()));
}

/** Apply screener exclusions + length gate for `top500_market` reads. */
export function normalizeTop500SnapshotRows(
  rows: readonly TopCompanyUniverseRow[] | null | undefined,
): TopCompanyUniverseRow[] | null {
  if (!rows?.length) return null;
  const filtered = filterScreenerTop500ExcludedTickers(rows).slice(0, 500);
  if (filtered.length < TOP500_SNAPSHOT_MIN_ROWS) return null;
  return filtered;
}
