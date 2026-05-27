import "server-only";

import { runWithProviderTraceCollect, type ProviderTraceSnapshot } from "@/lib/market/provider-trace";
import { peekEodhdRequestWindow } from "@/lib/market/eodhd-hourly-budget";
import {
  estimateDailyEodhdUsage,
  formatLoadEstimateReport,
  SCENARIO_1000_DAU_HEAVY,
  SCENARIO_1000_DAU_MODERATE,
  type EodhdDailyLoadEstimate,
} from "@/lib/market/eodhd-daily-load-model";
import { upsertAssetSnapshot } from "@/lib/market/asset-snapshot-store";
import { stripAssetSnapshotHotFields } from "@/lib/market/asset-snapshot-payload";
import { readHubSnapshot } from "@/lib/market/hub-snapshot-store";
import { HUB_SNAPSHOT_KEY, macroHubSegment } from "@/lib/market/hub-snapshot-keys";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import {
  getSimpleMarketDataScreenerStocks,
  getSimpleMarketDataScreenerStocksAllPages,
} from "@/lib/market/simple-market-layer";
import {
  loadStockPageInitialData,
  loadStockPageInitialDataUncached,
} from "@/lib/market/stock-page-initial-data";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";
import { shouldSkipMarketSnapshotIngest } from "@/lib/market/market-snapshot-ingest";

export type EodhdTrafficProbeOptions = {
  /** Ticker for asset cold/warm probes (default AAPL). */
  ticker?: string;
  /** When true, runs full market/hub cron ingest (expensive — off by default). */
  runCronIngest?: boolean;
};

export type EodhdTrafficProbeReport = {
  at: string;
  segment: string;
  marketMode: "live" | "frozen";
  probes: ProviderTraceSnapshot[];
  budget: ReturnType<typeof peekEodhdRequestWindow>;
  marketCronSkipReason: string | null;
  estimates: EodhdDailyLoadEstimate[];
  estimatesText: string;
};

async function probeScope(label: string, fn: () => Promise<void>): Promise<ProviderTraceSnapshot> {
  const { trace } = await runWithProviderTraceCollect(label, fn);
  return trace;
}

/**
 * Measures traced EODHD HTTP per representative server scope.
 * Use on staging with snapshots seeded; optional `runCronIngest` for worst-case cron cost.
 */
export async function runEodhdTrafficProbe(
  options: EodhdTrafficProbeOptions = {},
): Promise<EodhdTrafficProbeReport> {
  const ticker = (options.ticker ?? "AAPL").trim().toUpperCase();
  const epoch = getScreenerUsMarketCacheEpoch();
  const probes: ProviderTraceSnapshot[] = [];

  probes.push(
    await probeScope("screener/page1-snapshot-read", async () => {
      await getSimpleMarketDataScreenerStocks();
    }),
  );

  probes.push(
    await probeScope("screener/all-pages-snapshot-read", async () => {
      await getSimpleMarketDataScreenerStocksAllPages();
    }),
  );

  probes.push(
    await probeScope("market-snapshot/raw-read", async () => {
      await readMarketSnapshot(MARKET_SNAPSHOT_KEY.stocksAllPages);
    }),
  );

  probes.push(
    await probeScope("hub/macro-snapshot-read", async () => {
      await readHubSnapshot(HUB_SNAPSHOT_KEY.macroDashboard, macroHubSegment());
    }),
  );

  if (options.runCronIngest) {
    const { ingestMarketSnapshots } = await import("@/lib/market/market-snapshot-ingest");
    const { ingestHubSnapshots } = await import("@/lib/market/hub-snapshot-ingest");
    probes.push(
      await probeScope("cron/market-ingest", async () => {
        await ingestMarketSnapshots();
      }),
    );
    probes.push(
      await probeScope("cron/hub-ingest", async () => {
        await ingestHubSnapshots();
      }),
    );
  }

  const coldTrace = await runWithProviderTraceCollect(`asset/${ticker}-cold`, async () =>
    loadStockPageInitialDataUncached(ticker),
  );
  probes.push(coldTrace.trace);
  if (coldTrace.result) {
    await upsertAssetSnapshot(
      ticker,
      epoch.segment,
      stripAssetSnapshotHotFields(coldTrace.result, epoch.mode),
    );
  }

  probes.push(
    await probeScope(`asset/${ticker}-warm`, async () => {
      await loadStockPageInitialData(ticker);
    }),
  );

  const skipReason = await shouldSkipMarketSnapshotIngest();
  const estimates = [estimateDailyEodhdUsage(SCENARIO_1000_DAU_MODERATE), estimateDailyEodhdUsage(SCENARIO_1000_DAU_HEAVY)];

  return {
    at: new Date().toISOString(),
    segment: epoch.segment,
    marketMode: epoch.mode,
    probes,
    budget: peekEodhdRequestWindow(),
    marketCronSkipReason: skipReason,
    estimates,
    estimatesText: formatLoadEstimateReport(estimates),
  };
}
