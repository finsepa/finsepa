import "server-only";

import { loadStockKeyStatsBundleForApi } from "@/lib/market/stock-key-stats-bundle-cache";
import { pickKeyStatCellFromBundle } from "@/lib/screener/screener-key-stat-cell-pick";
import type { ScreenerKeyStatMetricDef } from "@/lib/screener/screener-key-stats-metric-catalog";
import { readScreenerKeyStatCellSnapshot, upsertScreenerKeyStatCellSnapshot } from "@/lib/screener/screener-key-stat-snapshot";

export const SCREENER_KEY_STAT_BATCH_CHUNK_SIZE = 6;

export type ScreenerKeyStatCellsBatchResult = Record<string, Record<string, string>>;

function emptyBatch(metrics: ScreenerKeyStatMetricDef[]): ScreenerKeyStatCellsBatchResult {
  const out: ScreenerKeyStatCellsBatchResult = {};
  for (const metric of metrics) out[metric.id] = {};
  return out;
}

async function fillTickerCells(
  ticker: string,
  metrics: ScreenerKeyStatMetricDef[],
  out: ScreenerKeyStatCellsBatchResult,
): Promise<void> {
  const missing: ScreenerKeyStatMetricDef[] = [];

  for (const metric of metrics) {
    const snap = await readScreenerKeyStatCellSnapshot(metric.id, ticker);
    if (snap !== undefined) {
      out[metric.id]![ticker] = snap;
      continue;
    }
    missing.push(metric);
  }

  if (!missing.length) return;

  const bundle = await loadStockKeyStatsBundleForApi(ticker);
  for (const metric of missing) {
    const value = pickKeyStatCellFromBundle(bundle, metric.section, metric.label);
    out[metric.id]![ticker] = value;
    void upsertScreenerKeyStatCellSnapshot(metric.id, ticker, value);
  }
}

/**
 * Loads screener key-stat cells for many metrics × tickers.
 * One cached fundamentals bundle fetch per ticker (when any cell misses snapshot).
 */
export async function fetchScreenerKeyStatCellsBatch(
  tickers: string[],
  metrics: ScreenerKeyStatMetricDef[],
): Promise<ScreenerKeyStatCellsBatchResult> {
  if (!tickers.length || !metrics.length) return emptyBatch(metrics);

  const out = emptyBatch(metrics);

  for (let i = 0; i < tickers.length; i += SCREENER_KEY_STAT_BATCH_CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + SCREENER_KEY_STAT_BATCH_CHUNK_SIZE);
    await Promise.all(chunk.map((ticker) => fillTickerCells(ticker, metrics, out)));
  }

  return out;
}
