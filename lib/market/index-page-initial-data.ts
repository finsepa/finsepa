import "server-only";

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
import { stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import { loadPortfolioSymbolEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { loadIndexComponentsLimited } from "@/lib/market/index-page-meta";
import {
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
import {
  STOCK_CHART_ALL_LOOKBACK_YEARS,
  type StockChartPoint,
  type StockChartRange,
} from "@/lib/market/stock-chart-types";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export {
  INDEX_CHART_RANGES,
  isIndexChartRange,
  type IndexChartRange,
  type IndexPageInitialData,
} from "@/lib/market/index-page-shared";

const DEFAULT_RANGE: IndexChartRange = "1Y";

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

export async function getIndexChartPoints(
  symbol: string,
  range: StockChartRange,
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !isIndexChartRange(range)) return [];

  const to = ymdUtc(now);
  const fromDate = new Date(now);
  if (range === "ALL") {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  } else if (range === "5Y") {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  } else {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 2);
  }
  const from = ymdUtc(fromDate);
  const bars = await loadPortfolioSymbolEodBars(sym, from, to);
  if (!bars?.length) return [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  return stockChartPointsFromDailyBars(sorted, range, now);
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

  const [bars, components] = await Promise.all([
    loadPortfolioSymbolEodBars(sym, from, to),
    showComponents ? loadIndexComponentsLimited(sym, 50) : Promise.resolve([] as IndexComponentRow[]),
  ]);

  const sorted = bars.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const performance = computeStockPerformanceFromSortedDailyBars(sorted, sym, now);
  const chartPoints = stockChartPointsFromDailyBars(sorted, DEFAULT_RANGE, now);

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
 * Chart range APIs (`getIndexChartPoints`) remain on-demand and are out of this pass.
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
