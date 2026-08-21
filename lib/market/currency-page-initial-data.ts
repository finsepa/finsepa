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
import {
  currencyDisplayCode,
  isCurrencyChartRange,
  isCurrencyPageSymbol,
  resolveCurrencyPageTitle,
  type CurrencyChartRange,
  type CurrencyPageInitialData,
} from "@/lib/market/currency-page-shared";
import { loadPortfolioSymbolEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import {
  getRouteAssetPageCacheSegment,
  readRouteAssetPageSnapshot,
  routeAssetPageSnapshotKey,
  upsertRouteAssetPageSnapshot,
} from "@/lib/market/route-asset-page-snapshot-store";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { loadStockStyleChartPointsForProviderSymbol } from "@/lib/market/stock-chart-data";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export {
  CURRENCY_CHART_RANGES,
  isCurrencyChartRange,
  type CurrencyChartRange,
  type CurrencyPageInitialData,
} from "@/lib/market/currency-page-shared";

/** Open on 1D like stocks — stock-style loaders, no live WS. */
const DEFAULT_RANGE: CurrencyChartRange = "1D";

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

function emptyPayload(routeSymbol: string): CurrencyPageInitialData {
  const sym = routeSymbol.trim().toUpperCase();
  return {
    routeSymbol: sym,
    displayName: resolveCurrencyPageTitle(sym),
    displayCode: currencyDisplayCode(sym),
    chart: { range: DEFAULT_RANGE, points: [] },
    performance: emptyPerformance(sym),
  };
}

/**
 * Currency charts → stock range strategies + HOT cache.
 * No live 1D. `.FOREX` disables US RTH via loadStockStyleChartPointsForProviderSymbol.
 */
const getCurrencyChartPointsCached = unstable_cache(
  async (providerSymbol: string, range: StockChartRange): Promise<StockChartPoint[]> => {
    return loadStockStyleChartPointsForProviderSymbol(providerSymbol, range);
  },
  ["currency-stock-pipeline-v1"],
  { revalidate: REVALIDATE_HOT },
);

export async function getCurrencyChartPoints(
  symbol: string,
  range: StockChartRange,
  _now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !isCurrencyChartRange(range)) return [];
  return getCurrencyChartPointsCached(sym, range);
}

export async function loadCurrencyPageInitialDataUncached(
  routeSymbol: string,
): Promise<CurrencyPageInitialData> {
  const sym = routeSymbol.trim().toUpperCase();
  if (!sym || !isCurrencyPageSymbol(sym)) return emptyPayload(sym);
  if (isSingleAssetMode()) return emptyPayload(sym);

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);

  const [bars, chartPoints] = await Promise.all([
    loadPortfolioSymbolEodBars(sym, from, to),
    getCurrencyChartPoints(sym, DEFAULT_RANGE, now),
  ]);
  const sorted = bars.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const performance = computeStockPerformanceFromSortedDailyBars(sorted, sym, now);

  return {
    routeSymbol: sym,
    displayName: resolveCurrencyPageTitle(sym),
    displayCode: currencyDisplayCode(sym),
    chart: { range: DEFAULT_RANGE, points: chartPoints },
    performance,
  };
}

/**
 * Durable `asset_currency_{SYM}` + single-flight cold miss.
 * Chart ranges use stock-style HOT cache via `getCurrencyChartPoints`.
 */
export async function loadCurrencyPageInitialData(
  routeSymbol: string,
): Promise<CurrencyPageInitialData> {
  const sym = routeSymbol.trim().toUpperCase();
  if (!sym) return emptyPayload("");
  if (isSingleAssetMode()) return emptyPayload(sym);

  const segment = getRouteAssetPageCacheSegment("currency");
  const cachedHit = await readRouteAssetPageSnapshot<CurrencyPageInitialData>("currency", sym, segment, {
    allowStale: true,
  });

  if (cachedHit?.payload?.routeSymbol?.trim().toUpperCase() === sym) {
    return cachedHit.payload;
  }

  const snapKey = routeAssetPageSnapshotKey("currency", sym);
  if (!snapKey) return emptyPayload(sym);

  type Hit = { payload: CurrencyPageInitialData; exactSegment: boolean };

  const page = await runColdMissSingleFlight<CurrencyPageInitialData, Hit>({
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(snapKey, segment, ownerId, ASSET_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(snapKey, segment, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(snapKey, segment, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: () => loadCurrencyPageInitialDataUncached(sym),
    persistSnapshot: async (fresh) => {
      const res = await upsertRouteAssetPageSnapshot("currency", sym, segment, fresh);
      return res.ok ? { ok: true } : { ok: false, reason: res.reason };
    },
    readSnapshot: () =>
      readRouteAssetPageSnapshot<CurrencyPageInitialData>("currency", sym, segment, {
        allowStale: true,
      }),
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
