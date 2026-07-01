import "server-only";

import {
  aggregateWarmFailureTaxonomy,
  classifyEarningsDocumentWarmResult,
  type EarningsDocumentWarmTickerResult,
} from "@/lib/market/earnings-document-warm-taxonomy";
import {
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
 * Rotates through each shard across days so the full top-100 list is warmed over a week.
 */
export async function warmEarningsDocumentCacheBatch(
  options?: EarningsDocumentCacheWarmOptions,
): Promise<EarningsDocumentCacheWarmResult> {
  const universe = await listEarningsDocumentWarmUniverse();
  const shardCount = options?.shardCount ?? EARNINGS_WARM_SHARD_COUNT;
  const shard =
    options?.shard ?? new Date().getUTCDay() % shardCount;

  const shardPick =
    options?.tickers != null
      ? {
          shard,
          shardCount,
          tickers: [...options.tickers],
          totalInShard: options.tickers.length,
        }
      : tickersForWarmShard(universe, shard, {
          shardCount,
          perRun: options?.perRun ?? EARNINGS_WARM_TICKERS_PER_RUN,
        });

  const perTicker: EarningsDocumentWarmTickerResult[] = [];
  const errors: string[] = [];

  for (const ticker of shardPick.tickers) {
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
      shard: shardPick.shard,
      processed: perTicker.length,
      taxonomy,
      coverage,
      errors: errors.length,
    }),
  );

  return {
    at: new Date().toISOString(),
    shard: shardPick.shard,
    shardCount,
    universeSize: universe.length,
    totalInShard: shardPick.totalInShard,
    processed: perTicker.length,
    taxonomy,
    coverage,
    perTicker,
    errors,
  };
}
