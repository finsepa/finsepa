import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import {
  ASSET_REBUILD_LEASE_TTL_SEC,
  ASSET_REBUILD_WAITER_MAX_MS,
  ASSET_REBUILD_WAITER_POLL_MS,
  failAssetRebuildLease,
  newAssetRebuildLeaseOwner,
  releaseAssetRebuildLease,
  sleepMs,
  tryAcquireAssetRebuildLease,
} from "@/lib/market/asset-rebuild-lease";
import { runColdMissSingleFlight } from "@/lib/market/asset-rebuild-single-flight";
import { loadPortfolioSymbolEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { loadIndexComponentsLimited } from "@/lib/market/index-page-meta";
import {
  indexDisablesUsSessionFilters,
  indexDisplayCode,
  indexSupportsComponents,
  isIndexChartRange,
  isIndexPageSymbol,
  resolveIndexPageTitle,
  type IndexChartRange,
  type IndexComponentRow,
  type IndexPageInitialData,
} from "@/lib/market/index-page-shared";
import {
  getRouteAssetPageCacheSegment,
  readRouteAssetPageSnapshot,
  routeAssetPageSnapshotKey,
  upsertRouteAssetPageSnapshot,
} from "@/lib/market/route-asset-page-snapshot-store";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { loadStockStyleChartPointsForProviderSymbol } from "@/lib/market/stock-chart-data";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export {
  INDEX_CHART_RANGES,
  isIndexChartRange,
  type IndexChartRange,
  type IndexPageInitialData,
} from "@/lib/market/index-page-shared";

/** Open on 1D like stocks — stock-style loaders, no live WS. */
const DEFAULT_RANGE: IndexChartRange = "1D";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyPerformance(ticker: string): StockPerformance {
  return {
    ticker,
    price: null,
    d1: null,
    d5: null,
    d7: null,
    m1: null,
    m6: null,
    ytd: null,
    y1: null,
    y5: null,
    y10: null,
    all: null,
    annualReturns: emptyAnnualReturns(),
  };
}

function emptyPayload(routeSymbol: string): IndexPageInitialData {
  const sym = routeSymbol.trim().toUpperCase();
  return {
    routeSymbol: sym,
    displayName: resolveIndexPageTitle(sym),
    displayCode: indexDisplayCode(sym),
    chart: { range: DEFAULT_RANGE, points: [] },
    performance: emptyPerformance(sym),
    components: [],
    showComponents: indexSupportsComponents(sym),
    news: [],
  };
}

/**
 * Index charts → same stock range strategies + HOT cache as equities.
 * No live 1D path. Non-US symbols skip US RTH filters.
 */
const getIndexChartPointsCached = unstable_cache(
  async (providerSymbol: string, range: StockChartRange, noUsRth: "0" | "1"): Promise<StockChartPoint[]> => {
    return loadStockStyleChartPointsForProviderSymbol(providerSymbol, range, {
      disableUsSessionFilters: noUsRth === "1",
    });
  },
  ["index-stock-pipeline-v1"],
  { revalidate: REVALIDATE_HOT },
);

export async function getIndexChartPoints(
  symbol: string,
  range: StockChartRange,
  _now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !isIndexChartRange(range)) return [];
  const noUsRth = indexDisablesUsSessionFilters(sym) ? "1" : "0";
  return getIndexChartPointsCached(sym, range, noUsRth);
}

export async function loadIndexPageInitialDataUncached(routeSymbol: string): Promise<IndexPageInitialData> {
  const sym = routeSymbol.trim().toUpperCase();
  if (!sym || !isIndexPageSymbol(sym)) return emptyPayload(sym);
  if (isSingleAssetMode()) return emptyPayload(sym);

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);

  const showComponents = indexSupportsComponents(sym);

  const [bars, components, chartPoints] = await Promise.all([
    loadPortfolioSymbolEodBars(sym, from, to),
    showComponents ? loadIndexComponentsLimited(sym, 50) : Promise.resolve([] as IndexComponentRow[]),
    getIndexChartPoints(sym, DEFAULT_RANGE, now),
  ]);

  const sorted = bars.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const performance = computeStockPerformanceFromSortedDailyBars(sorted, sym, now);

  return {
    routeSymbol: sym,
    displayName: resolveIndexPageTitle(sym),
    displayCode: indexDisplayCode(sym),
    chart: { range: DEFAULT_RANGE, points: chartPoints },
    performance,
    components,
    showComponents,
    news: [],
  };
}

/**
 * Durable `asset_index_{SYM}` + single-flight cold miss. Warm hit unchanged (serve snapshot).
 * Chart range APIs use stock-style HOT cache via `getIndexChartPoints`.
 */
export async function loadIndexPageInitialData(routeSymbol: string): Promise<IndexPageInitialData> {
  const sym = routeSymbol.trim().toUpperCase();
  if (!sym) return emptyPayload("");
  if (isSingleAssetMode()) return emptyPayload(sym);

  const segment = getRouteAssetPageCacheSegment("index");
  const cachedHit = await readRouteAssetPageSnapshot<IndexPageInitialData>("index", sym, segment, {
    allowStale: true,
  });

  if (cachedHit?.payload?.routeSymbol?.trim().toUpperCase() === sym) {
    return cachedHit.payload;
  }

  const snapKey = routeAssetPageSnapshotKey("index", sym);
  if (!snapKey) return emptyPayload(sym);

  type Hit = { payload: IndexPageInitialData; exactSegment: boolean };

  const page = await runColdMissSingleFlight<IndexPageInitialData, Hit>({
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(snapKey, segment, ownerId, ASSET_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(snapKey, segment, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(snapKey, segment, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: () => loadIndexPageInitialDataUncached(sym),
    persistSnapshot: async (fresh) => {
      const res = await upsertRouteAssetPageSnapshot("index", sym, segment, fresh);
      return res.ok ? { ok: true } : { ok: false, reason: res.reason };
    },
    readSnapshot: () =>
      readRouteAssetPageSnapshot<IndexPageInitialData>("index", sym, segment, { allowStale: true }),
    isUsableHit: (hit) => hit?.payload?.routeSymbol?.trim().toUpperCase() === sym,
    pageFromSnapshot: async (hit) => hit.payload,
    fallbackPage: () => emptyPayload(sym),
    sleep: sleepMs,
    now: () => Date.now(),
    waiterMaxMs: ASSET_REBUILD_WAITER_MAX_MS,
    pollMs: ASSET_REBUILD_WAITER_POLL_MS,
  });

  return page ?? emptyPayload(sym);
}
