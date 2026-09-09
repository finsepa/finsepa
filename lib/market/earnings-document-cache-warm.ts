import "server-only";

import { listTickersWithPartialSlidesGaps } from "@/lib/market/earnings-document-cache-store";
import {
  aggregateWarmFailureTaxonomy,
  classifyEarningsDocumentWarmResult,
  type EarningsDocumentWarmTickerResult,
} from "@/lib/market/earnings-document-warm-taxonomy";
import {
  EARNINGS_WARM_GAP_BACKFILL_PER_RUN,
  EARNINGS_WARM_SHARD_COUNT,
  EARNINGS_WARM_TICKERS_PER_RUN,
  listEarningsDocumentWarmUniverse,
  tickersForWarmShard,
} from "@/lib/market/earnings-document-warm-universe";
import { warmStockEarningsDocumentCache } from "@/lib/market/stock-earnings-tab-data";

export type EarningsDocumentCacheWarmOptions = {
  /** Shard index 0..shardCount-1. Defaults to UTC weekday. */
  shard?: number;
  shardCount?: number;
  perRun?: number;
  /** When set, warm exactly these tickers (ignores shard rotation). */
  tickers?: readonly string[];
};

export type EarningsDocumentCacheWarmResult = {
  at: string;
  shard: number;
  shardCount: number;
  universeSize: number;
  totalInShard: number;
  processed: number;
  gapBackfill: string[];
  taxonomy: ReturnType<typeof aggregateWarmFailureTaxonomy>;
  coverage: {
    recentReportedRows: number;
    withSlides: number;
    withFilings: number;
  };
  perTicker: EarningsDocumentWarmTickerResult[];
  errors: string[];
};

/**
 * Pre-resolve earnings slides/filings for screener universe tickers (sharded daily cron).
 * Rotates shards across the week; reserves a few slots for partial slides-gap backfill.
 * Cap stays low (≤10/run) so EODHD + SEC budget fits ~500–1000 DAU.
 */
export async function warmEarningsDocumentCacheBatch(
  options?: EarningsDocumentCacheWarmOptions,
): Promise<EarningsDocumentCacheWarmResult> {
  const universe = await listEarningsDocumentWarmUniverse();
  const shardCount = options?.shardCount ?? EARNINGS_WARM_SHARD_COUNT;
  const shard = options?.shard ?? new Date().getUTCDay() % shardCount;
  const perRun = options?.perRun ?? EARNINGS_WARM_TICKERS_PER_RUN;

  let gapBackfill: string[] = [];
  let tickers: string[];
  let totalInShard: number;

  if (options?.tickers != null) {
    tickers = [...options.tickers];
    totalInShard = options.tickers.length;
  } else {
    const shardPick = tickersForWarmShard(universe, shard, {
      shardCount,
      perRun,
    });
    totalInShard = shardPick.totalInShard;

    const gapSlots = Math.min(EARNINGS_WARM_GAP_BACKFILL_PER_RUN, Math.max(0, perRun - 1));
    gapBackfill = await listTickersWithPartialSlidesGaps(universe, gapSlots);

    const seen = new Set(gapBackfill);
    const remainder: string[] = [];
    for (const t of shardPick.tickers) {
      if (seen.has(t)) continue;
      seen.add(t);
      remainder.push(t);
      if (gapBackfill.length + remainder.length >= perRun) break;
    }
    tickers = [...gapBackfill, ...remainder].slice(0, perRun);
  }

  const perTicker: EarningsDocumentWarmTickerResult[] = [];
  const errors: string[] = [];

  for (const ticker of tickers) {
    try {
      perTicker.push(await warmStockEarningsDocumentCache(ticker));
    } catch (e) {
      const message = e instanceof Error ? e.message : "warm_error";
      errors.push(`${ticker}:${message}`);
      perTicker.push({
        ticker,
        failureClass: "error",
        reportedRows: 0,
        recentReportedRows: 0,
        withSlides: 0,
        withFilings: 0,
        missingSlides: 0,
        missingFilings: 0,
        withEightK: 0,
        withForm10: 0,
        bothReports: 0,
        slideFormats: {},
      });
    }
  }

  const taxonomy = aggregateWarmFailureTaxonomy(perTicker);
  const coverage = perTicker.reduce(
    (acc, row) => {
      acc.recentReportedRows += row.recentReportedRows;
      acc.withSlides += row.withSlides;
      acc.withFilings += row.withFilings;
      return acc;
    },
    { recentReportedRows: 0, withSlides: 0, withFilings: 0 },
  );

  console.info(
    "[earnings-document-cache-warm]",
    JSON.stringify({
      shard,
      processed: perTicker.length,
      gapBackfill,
      taxonomy,
      coverage,
      errors: errors.length,
    }),
  );

  return {
    at: new Date().toISOString(),
    shard,
    shardCount,
    universeSize: universe.length,
    totalInShard,
    processed: perTicker.length,
    gapBackfill,
    taxonomy,
    coverage,
    perTicker,
    errors,
  };
}
