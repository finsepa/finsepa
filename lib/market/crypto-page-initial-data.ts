import "server-only";

import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isUsableCryptoPageSnapshot } from "@/lib/market/crypto-page-snapshot-usability";
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
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { buildCryptoAssetRowFromDailyBars } from "@/lib/market/crypto-asset";
import { stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { isCryptoLive1DSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { usesCryptoStockPipelineExperiment } from "@/lib/market/crypto-stock-pipeline-experiment";
import { getCryptoChartPointsViaStockPipeline } from "@/lib/market/crypto-stock-pipeline-experiment.server";
import { getCryptoNewsForPage } from "@/lib/market/crypto-news";
import {
  cryptoPageSnapshotKey,
  cryptoPageSnapshotToPageData,
  getCryptoPageCacheSegment,
  readCryptoPageSnapshot,
  stripCryptoPageSnapshotHotFields,
  upsertCryptoPageSnapshot,
  type CryptoPageSnapshotPayload,
} from "@/lib/market/crypto-page-snapshot-store";
import {
  fetchEodhdCryptoDailyBarsForMeta,
  lastPositiveCloseFromCryptoBars,
} from "@/lib/market/eodhd-crypto";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode } from "@/lib/features/single-asset";

const DEFAULT_RANGE: StockChartRange = "1Y";
const SESSION_RANGE: StockChartRange = "1D";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyPerformance(routeSymbol: string): StockPerformance {
  const sym = routeSymbol.trim().toUpperCase();
  return {
    ticker: sym,
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

function emptyPayload(routeSymbol: string): CryptoPageInitialData {
  return {
    routeSymbol,
    asset: null,
    chart: { range: DEFAULT_RANGE, points: [] },
    sessionChart: { range: SESSION_RANGE, points: [] },
    performance: emptyPerformance(routeSymbol),
    news: [],
    headerLiveSpotUsd: null,
  };
}

export type CryptoPageInitialData = {
  routeSymbol: string;
  asset: CryptoAssetRow | null;
  chart: { range: StockChartRange; points: StockChartPoint[] };
  /** Preloaded 1D series for the offscreen header chart (BTC live only). */
  sessionChart: { range: StockChartRange; points: StockChartPoint[] };
  performance: StockPerformance;
  news: StockNewsArticle[];
  /** Best-effort USD spot for header fallback (daily close; client live-price poll refreshes). */
  headerLiveSpotUsd: number | null;
};

function scheduleCryptoPageSnapshotWrite(
  symbol: string,
  segment: string,
  data: CryptoPageInitialData,
) {
  const payload = stripCryptoPageSnapshotHotFields(data);
  if (!isUsableCryptoPageSnapshot(payload)) return;
  void upsertCryptoPageSnapshot(symbol, segment, payload).then((res) => {
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[crypto-page-snapshot] upsert failed", { symbol, reason: res.reason });
    }
  });
}

async function persistCryptoPageSnapshotAwaited(
  symbol: string,
  segment: string,
  data: CryptoPageInitialData,
): Promise<{ ok: boolean; reason?: string }> {
  const payload = stripCryptoPageSnapshotHotFields(data);
  if (!isUsableCryptoPageSnapshot(payload)) {
    return { ok: false, reason: "unusable_snapshot" };
  }
  const res = await upsertCryptoPageSnapshot(symbol, segment, payload);
  if (!res.ok && process.env.NODE_ENV === "development") {
    console.warn("[crypto-page-snapshot] awaited upsert failed", { symbol, reason: res.reason });
  }
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

/**
 * Server pass for crypto detail: one daily-bars fetch for asset + 1Y chart + performance.
 * Slim SSR (parity with stock B): cold miss returns above-fold first; news + live 1D session
 * finish in the background and are written into the snapshot for warm hits.
 */

type CryptoPageRebuildHandle = {
  aboveFold: Promise<CryptoPageInitialData>;
  full: Promise<CryptoPageInitialData>;
};

const coldMissFullByPage = new WeakMap<CryptoPageInitialData, Promise<CryptoPageInitialData>>();

async function beginCryptoPageRebuild(sym: string): Promise<CryptoPageRebuildHandle | null> {
  const meta = await resolveCryptoMetaForProvider(sym);
  if (!meta) return null;

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);
  const live1d = isCryptoLive1DSymbol(sym);

  const dailyBarsPromise = fetchEodhdCryptoDailyBarsForMeta(meta, from, to);
  const sessionPointsPromise = live1d
    ? loadCryptoLive1DMinuteChartPoints(sym, now)
    : Promise.resolve([] as StockChartPoint[]);
  const newsPromise = getCryptoNewsForPage(sym);
  const experimentChartPromise = usesCryptoStockPipelineExperiment(sym)
    ? getCryptoChartPointsViaStockPipeline(sym, DEFAULT_RANGE)
    : Promise.resolve(null);

  const aboveFold = (async (): Promise<CryptoPageInitialData> => {
    const [dailyBars, experimentChart] = await Promise.all([
      dailyBarsPromise,
      experimentChartPromise,
    ]);
    const sorted = dailyBars?.length ? [...dailyBars].sort((a, b) => a.date.localeCompare(b.date)) : [];
    const [asset, performance] = await Promise.all([
      buildCryptoAssetRowFromDailyBars(meta, sorted),
      Promise.resolve(computeStockPerformanceFromSortedDailyBars(sorted, meta.symbol, now)),
    ]);
    const chartPoints =
      experimentChart ?? stockChartPointsFromDailyBars(sorted, DEFAULT_RANGE, now);
    const closeSpot = lastPositiveCloseFromCryptoBars(sorted);
    const headerSpot =
      typeof closeSpot === "number" && Number.isFinite(closeSpot) && closeSpot > 0 ? closeSpot : null;

    return {
      routeSymbol: sym,
      asset,
      chart: { range: DEFAULT_RANGE, points: chartPoints },
      sessionChart: { range: SESSION_RANGE, points: [] },
      performance,
      news: [],
      headerLiveSpotUsd: headerSpot,
    };
  })();

  const full = (async (): Promise<CryptoPageInitialData> => {
    const base = await aboveFold;
    const [sessionPoints, news] = await Promise.all([sessionPointsPromise, newsPromise]);
    const lastSession =
      sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1]?.value : null;
    const headerSpot =
      typeof lastSession === "number" && Number.isFinite(lastSession) && lastSession > 0
        ? lastSession
        : base.headerLiveSpotUsd;

    return {
      ...base,
      sessionChart: { range: SESSION_RANGE, points: sessionPoints },
      news: Array.isArray(news) ? news : [],
      headerLiveSpotUsd: headerSpot,
    };
  })();

  return { aboveFold, full };
}

/** Full rebuild (traffic probes / NVDA-mode empty). */
export async function loadCryptoPageInitialDataUncached(routeSymbol: string): Promise<CryptoPageInitialData> {
  const raw = routeSymbol.trim();
  if (!raw) return emptyPayload("");

  const sym = cryptoRouteBase(raw).toUpperCase();

  if (isSingleAssetMode()) {
    return emptyPayload(sym);
  }

  const handle = await beginCryptoPageRebuild(sym);
  if (!handle) return emptyPayload(sym);
  return handle.full;
}

async function loadCryptoPageColdMissAboveFold(routeSymbol: string): Promise<CryptoPageInitialData> {
  const sym = cryptoRouteBase(routeSymbol.trim()).toUpperCase();
  if (!sym || isSingleAssetMode()) return emptyPayload(sym);

  const handle = await beginCryptoPageRebuild(sym);
  if (!handle) return emptyPayload(sym);
  const page = await handle.aboveFold;
  coldMissFullByPage.set(page, handle.full);
  return page;
}

async function resolveCryptoPageForPersist(page: CryptoPageInitialData): Promise<CryptoPageInitialData> {
  const full = coldMissFullByPage.get(page);
  if (!full) return page;
  try {
    return await full;
  } catch (err) {
    console.warn("[loadCryptoPageInitialData] fat persist enrich failed; writing slim shell", {
      symbol: page.routeSymbol,
      err,
    });
    return page;
  } finally {
    coldMissFullByPage.delete(page);
  }
}

/**
 * Prefer Supabase `asset_crypto_{SYM}` (stale OK up to 6h) so mid-traffic coins skip a cold
 * EODHD fan-out every 15m — same pattern as equity `asset_{TICKER}`.
 * Warm hit: return snapshot immediately (no SSR hot minute-chart / spot wait).
 * Client refreshes live-price + chart; cold miss uses single-flight rebuild.
 */
export async function loadCryptoPageInitialData(routeSymbol: string): Promise<CryptoPageInitialData | null> {
  const raw = routeSymbol.trim();
  if (!raw) return null;

  const sym = cryptoRouteBase(raw).toUpperCase();

  if (isSingleAssetMode()) {
    return emptyPayload(sym);
  }

  const segment = getCryptoPageCacheSegment();
  const cachedHit = await readCryptoPageSnapshot(sym, segment, { allowStale: true });

  if (
    cachedHit &&
    isUsableCryptoPageSnapshot(cachedHit.payload) &&
    cachedHit.payload.routeSymbol.trim().toUpperCase() === sym
  ) {
    const base = cryptoPageSnapshotToPageData(cachedHit.payload);
    // Same as equity warm path: paint from snapshot immediately.
    // Live spot is stripped in the stored payload; client `/live-price` poll refreshes it.
    // BTC/ETH session 1D (if present in snap) is used as seed; PriceChart refetches when needed.
    // Do not await SSR hot minute-chart / spot — that stalled soft-nav on live allowlist coins.
    if (!cachedHit.exactSegment) {
      scheduleCryptoPageSnapshotWrite(sym, segment, base);
    }
    return base;
  }

  const snapKey = cryptoPageSnapshotKey(sym);
  if (!snapKey) return emptyPayload(sym);

  type CryptoHit = { payload: CryptoPageSnapshotPayload; exactSegment: boolean };

  return runColdMissSingleFlight<CryptoPageInitialData, CryptoHit>({
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(snapKey, segment, ownerId, ASSET_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(snapKey, segment, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(snapKey, segment, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: () => loadCryptoPageColdMissAboveFold(sym),
    persistSnapshot: async (page) => {
      const full = await resolveCryptoPageForPersist(page);
      return persistCryptoPageSnapshotAwaited(sym, segment, full);
    },
    readSnapshot: () => readCryptoPageSnapshot(sym, segment, { allowStale: true }),
    isUsableHit: (hit) =>
      isUsableCryptoPageSnapshot(hit?.payload) &&
      hit?.payload?.routeSymbol?.trim().toUpperCase() === sym,
    pageFromSnapshot: async (hit) => cryptoPageSnapshotToPageData(hit.payload),
    fallbackPage: () => emptyPayload(sym),
    sleep: sleepMs,
    now: () => Date.now(),
    waiterMaxMs: ASSET_REBUILD_WAITER_MAX_MS,
    pollMs: ASSET_REBUILD_WAITER_POLL_MS,
  });
}
