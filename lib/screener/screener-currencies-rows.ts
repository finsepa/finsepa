import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET } from "@/lib/data/cache-policy";
import { fetchEodhdEodDailyScreener, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshotSlow } from "@/lib/market/market-snapshot-store";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc } from "@/lib/screener/eod-derived-metrics";
import {
  SCREENER_CURRENCY_MAJORS,
  type CurrencyTableRow,
} from "@/lib/screener/screener-currencies-universe";
import { SCREENER_EOD_DERIVED_INDEX_CONCURRENCY } from "@/lib/screener/screener-scale-config";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

/**
 * EOD-only FX majors — one daily-bar pull per pair (price + 1D + 1M/YTD).
 * Does not touch `simple-market-layer` realtime batches.
 * Tab API bypasses US equity session freeze; cron warms {@link MARKET_SNAPSHOT_KEY.currenciesTab}.
 */
function rowFromBars(name: string, symbol: string, code: string, bars: EodhdDailyBar[]): CurrencyTableRow {
  if (!bars.length) {
    return {
      name,
      symbol,
      code,
      value: Number.NaN,
      change1D: Number.NaN,
      change1M: null,
      changeYTD: null,
    };
  }
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2]! : null;
  const price =
    typeof last.close === "number" && Number.isFinite(last.close) && last.close > 0 ? last.close : null;
  const previousClose =
    prev && typeof prev.close === "number" && Number.isFinite(prev.close) && prev.close > 0
      ? prev.close
      : null;
  const change1D =
    price != null && previousClose != null && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : Number.NaN;
  const derived =
    price != null ? deriveMetricsFromDailyBars(sorted, price) : { changePercent1M: null, changePercentYTD: null };

  return {
    name,
    symbol,
    code,
    value: price ?? Number.NaN,
    change1D,
    change1M: derived.changePercent1M,
    changeYTD: derived.changePercentYTD,
  };
}

async function loadCurrenciesTableRowsUncached(): Promise<CurrencyTableRow[]> {
  const window = eodFetchWindowUtc();
  const barsList = await runWithConcurrencyLimit(
    [...SCREENER_CURRENCY_MAJORS],
    SCREENER_EOD_DERIVED_INDEX_CONCURRENCY,
    (pair) => fetchEodhdEodDailyScreener(pair.symbol, window.from, window.to),
  );
  return SCREENER_CURRENCY_MAJORS.map((pair, i) => {
    const raw = barsList[i];
    return rowFromBars(pair.name, pair.symbol, pair.code, Array.isArray(raw) ? raw : []);
  });
}

const getScreenerCurrenciesMajorsRowsCached = unstable_cache(
  loadCurrenciesTableRowsUncached,
  ["screener-currencies-majors-eod-v2"],
  { revalidate: REVALIDATE_SCREENER_MARKET },
);

/** Snapshot-first, then shared TTL cache — 0 EODHD when cron/`market_snapshot` is warm. */
export async function getScreenerCurrenciesMajorsRows(): Promise<CurrencyTableRow[]> {
  const snap = await readMarketSnapshotSlow<CurrencyTableRow[]>(MARKET_SNAPSHOT_KEY.currenciesTab);
  if (Array.isArray(snap) && snap.length) return snap;
  return getScreenerCurrenciesMajorsRowsCached();
}

/** Cron ingest — bypasses snapshot reads. */
export async function buildMarketSnapshotCurrenciesTabForIngest(): Promise<CurrencyTableRow[]> {
  return loadCurrenciesTableRowsUncached();
}
