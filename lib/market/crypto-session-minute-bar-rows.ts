import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/**
 * Safety cap across paginated reads. A rolling 24h of 1m bars is ~1440 rows.
 * PostgREST/`db-max-rows` still caps each response (~1000), so callers must page.
 */
export const CRYPTO_MINUTE_BAR_READ_LIMIT = 2_000;

/** Per-request page size (at or below typical PostgREST max-rows). */
export const CRYPTO_MINUTE_BAR_READ_PAGE_SIZE = 1_000;

export type CryptoMinuteBarRow = { bucket_unix: unknown; close: unknown };

/** Map DB rows → chart points (ascending, one point per bucket_unix). */
export function mapCryptoMinuteBarRows(
  rows: readonly CryptoMinuteBarRow[],
): StockChartPoint[] {
  const points: StockChartPoint[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    const time = Number(row.bucket_unix);
    const value = Number(row.close);
    if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
    if (seen.has(time)) continue;
    seen.add(time);
    points.push({ time, value, timeZone: "UTC" });
  }

  points.sort((a, b) => a.time - b.time);
  return points;
}

/**
 * Append one PostgREST page and report whether more pages are needed.
 * Stops when a short page arrives or the safety cap is reached.
 */
export function accumulateCryptoMinuteBarPages(
  acc: CryptoMinuteBarRow[],
  page: readonly CryptoMinuteBarRow[],
  pageSize: number = CRYPTO_MINUTE_BAR_READ_PAGE_SIZE,
  safetyCap: number = CRYPTO_MINUTE_BAR_READ_LIMIT,
): { rows: CryptoMinuteBarRow[]; done: boolean } {
  for (const row of page) {
    if (acc.length >= safetyCap) {
      return { rows: acc, done: true };
    }
    acc.push(row);
  }
  const done = page.length < pageSize || acc.length >= safetyCap;
  return { rows: acc, done };
}
