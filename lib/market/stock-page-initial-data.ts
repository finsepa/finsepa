import "server-only";

import { type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { loadPortfolioSymbolEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import {
  getStockSpotQuoteForApi,
  getStockChartPointsForApi,
  isStock1DLiveSessionMinuteChart,
  stockChartPointsFromDailyBars,
} from "@/lib/market/stock-chart-data";
import { usesStock1DLiveWsMinutePipeline } from "@/lib/market/stock-1d-live-minute-chart-tickers";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import { stockKeyIndicatorsServerEnabled } from "@/lib/features/key-indicators";
import { getStockKeyIndicators, type StockKeyIndicatorsLoadOpts } from "@/lib/market/stock-key-indicators-service";
import type { StockKeyIndicatorsResponse } from "@/lib/market/stock-key-indicators-types";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { STOCK_CHART_ALL_LOOKBACK_YEARS, type StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import { getStockNews } from "@/lib/market/stock-news";
import { fetchChartingSeriesWithDailyBars } from "@/lib/market/eodhd-charting-series";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";
import { fetchEodhdStockProfile } from "@/lib/market/eodhd-stock-profile";
import type { PeersCompareRow } from "@/lib/market/peers-compare-payload";
import { getPeersCompareRowsCached } from "@/lib/market/peers-compare-payload";
import type { StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";
import { getNvdaChartPoints, getNvdaHeaderMeta, getNvdaKeyStatsBundle, getNvdaPerformance } from "@/lib/fixtures/nvda";
import { getNvdaChartingSeriesPoints, getNvdaProfile, getNvdaStockNews } from "@/lib/fixtures/nvda";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { isStockDetailEtf } from "@/lib/stock/stock-etf";
import {
  assetSnapshotPayloadToPageData,
  stripAssetSnapshotHotFields,
} from "@/lib/market/asset-snapshot-payload";
import { readAssetSnapshotForPage, upsertAssetSnapshot } from "@/lib/market/asset-snapshot-store";
import { assetSnapshotKey } from "@/lib/market/asset-snapshot-keys";
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
import { runAssetColdMissSingleFlight } from "@/lib/market/asset-rebuild-single-flight";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

export type StockPageInitialChart = {
  range: StockChartRange;
  points: StockChartPoint[];
  /** 1D during US regular session — EODHD intraday + live OHLCV (~60s refresh). */
  liveSessionMinute?: boolean;
};

export type StockPageInitialData = {
  ticker: string;
  /** US ETF detail page — limits tabs and overview sections. */
  isEtf: boolean;
  headerMeta: StockDetailHeaderMeta;
  chart: StockPageInitialChart;
  performance: StockPerformance;
  keyStatsBundle: StockKeyStatsBundle;
  /**
   * Overview Key Indicators — loaded from `key_indicators_*` snapshot (or computed) in parallel with
   * the rest of the page so the card is not a post-paint client waterfall.
   */
  keyIndicators: StockKeyIndicatorsResponse | null;
  news: StockNewsArticle[];
  profile: StockProfilePayload | null;
  fundamentalsSeriesAnnual: ChartingSeriesPoint[];
  fundamentalsSeriesQuarterly: ChartingSeriesPoint[];
  /** TTM snapshot for Financials tables (from annual fundamentals bundle). */
  fundamentalsTtmPoint: ChartingSeriesPoint | null;
  /** Single-ticker peers compare row (same payload as POST /api/stocks/peers/compare with one symbol). */
  peersCompareRows: PeersCompareRow[];
  /**
   * Intraday-aligned USD spot for header fallback (same source as `getStockSpotPriceUsd` / live-price API).
   * Phase 7: fresher than mini-table EOD spot (`StockPerformance.price`) before the 1D chart publishes.
   */
  headerLiveSpotUsd: number | null;
  /** Prior session close from the same realtime quote as `headerLiveSpotUsd` (regular session only). */
  headerPriorCloseUsd: number | null;
  /**
   * False on US holidays during the 9:30–16:00 ET window (no live intraday) — header shows
   * last session at-close + after-hours instead of live "Today".
   */
  liveRegularSessionActive: boolean;
  /**
   * Earnings tab loads client-side via GET `/api/stocks/[ticker]/earnings` (kept off SSR so stock pages
   * do not block on heavy earnings enrichment or calendar fetches).
   */
  earningsTabPayload: StockEarningsTabPayload | null;
};

const DEFAULT_OVERVIEW_RANGE: StockChartRange = "1D";

const EMPTY_KEY_STATS: StockKeyStatsBundle = {
  basic: null,
  valuation: null,
  revenueProfit: null,
  margins: null,
  growth: null,
  assetsLiabilities: null,
  returns: null,
  dividends: null,
  risk: null,
};

function headerMetaShell(ticker: string): StockDetailHeaderMeta {
  const display = getStockDetailMetaFromTicker(ticker);
  return {
    fullName: display.name,
    logoUrl: display.logoUrl,
    exchange: null,
    countryIso: null,
    sector: null,
    industry: null,
    earningsDateDisplay: null,
    watchlistCount: null,
    screenerRank: null,
  };
}

function warnSettledFailure(label: string, reason: unknown) {
  console.warn(`[loadStockPageInitialData] ${label} failed`, reason);
}

function fromSettled<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === "fulfilled") return result.value;
  warnSettledFailure(label, result.reason);
  return null;
}

function resolveOverviewChartPoints(
  range: StockChartRange,
  chartPoints: StockChartPoint[] | null,
  sortedDailyBars: EodhdDailyBar[],
  now: Date,
): StockChartPoint[] {
  if (Array.isArray(chartPoints) && chartPoints.length > 0) return chartPoints;
  if (!sortedDailyBars.length) return [];
  if (range === "1D") {
    // 1D overview uses EODHD intraday only — daily open/close synthesis is a flat line.
    return [];
  }
  const fromDaily = sliceStockChartPointsForRange(stockChartPointsFromDailyBars(sortedDailyBars), range, now);
  if (fromDaily.length > 0) return fromDaily;
  return [];
}

function fallbackStockPageInitialData(ticker: string, now: Date): StockPageInitialData {
  return {
    ticker,
    isEtf: isStockDetailEtf(ticker, headerMetaShell(ticker)),
    headerMeta: headerMetaShell(ticker),
    chart: { range: DEFAULT_OVERVIEW_RANGE, points: [] },
    performance: computeStockPerformanceFromSortedDailyBars([], ticker, now),
    keyStatsBundle: { ...EMPTY_KEY_STATS },
    keyIndicators: null,
    news: [],
    profile: null,
    fundamentalsSeriesAnnual: [],
    fundamentalsSeriesQuarterly: [],
    fundamentalsTtmPoint: null,
    peersCompareRows: [],
    headerLiveSpotUsd: null,
    headerPriorCloseUsd: null,
    liveRegularSessionActive: false,
    earningsTabPayload: null,
  };
}

async function loadKeyIndicatorsForPage(
  ticker: string,
  opts?: StockKeyIndicatorsLoadOpts,
): Promise<StockKeyIndicatorsResponse | null> {
  if (!stockKeyIndicatorsServerEnabled()) return null;
  try {
    return await getStockKeyIndicators(ticker, opts);
  } catch (err) {
    warnSettledFailure("keyIndicators", err);
    return null;
  }
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function scheduleAssetSnapshotWrite(
  ticker: string,
  segment: string,
  data: StockPageInitialData,
  mode: ReturnType<typeof getScreenerUsMarketCacheEpoch>["mode"],
) {
  const payload = stripAssetSnapshotHotFields(data, mode);
  void upsertAssetSnapshot(ticker, segment, payload).then((res) => {
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[asset-snapshot] upsert failed", { ticker, reason: res.reason });
    }
  });
}

async function persistAssetSnapshotAwaited(
  ticker: string,
  segment: string,
  data: StockPageInitialData,
  mode: ReturnType<typeof getScreenerUsMarketCacheEpoch>["mode"],
): Promise<{ ok: boolean; reason?: string }> {
  const payload = stripAssetSnapshotHotFields(data, mode);
  const res = await upsertAssetSnapshot(ticker, segment, payload);
  if (!res.ok && process.env.NODE_ENV === "development") {
    console.warn("[asset-snapshot] awaited upsert failed", { ticker, reason: res.reason });
  }
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

function positiveUsd(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * One EOD daily fetch (same lookback as chart `ALL` / performance) powers overview chart + mini-table together.
 * Header + key-stats share one fundamentals fetch inside their respective loaders (bundle pulls once and passes root to sections).
 *
 * Slim SSR (roadmap B): cold miss returns above-fold as soon as header/bars/chart/spot settle;
 * fat arms (news, profile, fundamentals, key stats, peers, KI) keep running and are awaited only
 * for snapshot persist so warm hits still paint the full overview.
 */

type StockPageRebuildHandle = {
  /** Header + price + chart + performance (+ empty fat shells). */
  aboveFold: Promise<StockPageInitialData>;
  /** Full page including deferred fat sections. */
  full: Promise<StockPageInitialData>;
};

/** Page object → in-flight full rebuild (for cold-miss persist without poisoning snaps). */
const coldMissFullByPage = new WeakMap<StockPageInitialData, Promise<StockPageInitialData>>();

function loadNvdaFixturePage(ticker: string, range: StockChartRange): StockPageInitialData {
  const nvda1d = getNvdaChartPoints("1D");
  const nvdaLast = nvda1d.length ? nvda1d[nvda1d.length - 1]!.value : null;
  const headerLiveSpotUsd =
    typeof nvdaLast === "number" && Number.isFinite(nvdaLast) && nvdaLast > 0 ? nvdaLast : null;
  return {
    ticker,
    isEtf: false,
    headerMeta: getNvdaHeaderMeta(),
    chart: { range, points: getNvdaChartPoints(range) },
    performance: getNvdaPerformance(),
    keyStatsBundle: getNvdaKeyStatsBundle(),
    keyIndicators: null,
    news: getNvdaStockNews(),
    profile: getNvdaProfile(),
    fundamentalsSeriesAnnual: getNvdaChartingSeriesPoints("annual"),
    fundamentalsSeriesQuarterly: getNvdaChartingSeriesPoints("quarterly"),
    fundamentalsTtmPoint: null,
    peersCompareRows: [],
    headerLiveSpotUsd,
    headerPriorCloseUsd: null,
    liveRegularSessionActive: true,
    earningsTabPayload: null,
  };
}

function startStockPageRebuild(ticker: string, now: Date): StockPageRebuildHandle {
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  const from = ymdUtc(fromDate);
  const range: StockChartRange = DEFAULT_OVERVIEW_RANGE;

  const barsPromise = loadPortfolioSymbolEodBars(ticker, from, to);
  const sortedBarsPromise = barsPromise.then((barsRaw) =>
    barsRaw.length ? [...barsRaw].sort((a, b) => a.date.localeCompare(b.date)) : [],
  );
  const performancePromise = sortedBarsPromise.then((sorted) =>
    computeStockPerformanceFromSortedDailyBars(sorted, ticker, now),
  );
  const annualFromBars = sortedBarsPromise.then((sorted) =>
    fetchChartingSeriesWithDailyBars(ticker, "annual", sorted, { secBackfill: false }),
  );
  const quarterlyFromBars = sortedBarsPromise.then((sorted) =>
    fetchChartingSeriesWithDailyBars(ticker, "quarterly", sorted, { secBackfill: false }),
  );

  const headerMetaPromise = getStockDetailHeaderMetaForPage(ticker);
  const chartPointsPromise = getStockChartPointsForApi(ticker, range, "price");
  const spotPromise = getStockSpotQuoteForApi(ticker);
  // SSR / cold rebuild: skip SEC press-release backfill (roadmap C). Client key-stats +
  // fundamentals-series APIs still run the full path when the user opens those panels.
  const keyStatsPromise = buildStockKeyStatsBundle(ticker, { secBackfill: false });
  const keyIndicatorsPromise = loadKeyIndicatorsForPage(ticker, { stockPerformance: performancePromise });
  const newsPromise = getStockNews(ticker);
  const profilePromise = fetchEodhdStockProfile(ticker);
  const peersPromise = getPeersCompareRowsCached(ticker);

  const aboveFold = (async (): Promise<StockPageInitialData> => {
    const [headerMetaResult, barsResult, chartPointsResult, spotResult] = await Promise.allSettled([
      headerMetaPromise,
      barsPromise,
      chartPointsPromise,
      spotPromise,
    ]);

    const headerMeta = fromSettled(headerMetaResult, "headerMeta") ?? headerMetaShell(ticker);
    const barsRaw = fromSettled(barsResult, "eodDaily") ?? [];
    const chartPointsRaw = fromSettled(chartPointsResult, "chart1D");
    const spotQuote = fromSettled(spotResult, "headerLiveSpot");
    const sorted = barsRaw.length ? [...barsRaw].sort((a, b) => a.date.localeCompare(b.date)) : [];
    const performance = await performancePromise;
    const points = resolveOverviewChartPoints(range, chartPointsRaw, sorted, now);
    const liveRegularSessionActive =
      usesStock1DLiveWsMinutePipeline(ticker, now) || getUsEquityMarketSession(now) === "regular";
    const liveSessionMinute =
      range === "1D" ? isStock1DLiveSessionMinuteChart(ticker, now) : false;

    return {
      ticker,
      isEtf: isStockDetailEtf(ticker, headerMeta),
      headerMeta,
      chart: { range, points, liveSessionMinute },
      performance,
      keyStatsBundle: { ...EMPTY_KEY_STATS },
      keyIndicators: null,
      news: [],
      profile: null,
      fundamentalsSeriesAnnual: [],
      fundamentalsSeriesQuarterly: [],
      fundamentalsTtmPoint: null,
      peersCompareRows: [],
      headerLiveSpotUsd: positiveUsd(spotQuote?.price),
      headerPriorCloseUsd: positiveUsd(spotQuote?.previousClose),
      liveRegularSessionActive,
      earningsTabPayload: null,
    };
  })();

  const full = (async (): Promise<StockPageInitialData> => {
    const base = await aboveFold;
    const [
      keyStatsResult,
      keyIndicatorsResult,
      newsResult,
      profileResult,
      annualResult,
      quarterlyResult,
      peersResult,
    ] = await Promise.allSettled([
      keyStatsPromise,
      keyIndicatorsPromise,
      newsPromise,
      profilePromise,
      annualFromBars,
      quarterlyFromBars,
      peersPromise,
    ]);

    const keyStatsBundle = fromSettled(keyStatsResult, "keyStats") ?? { ...EMPTY_KEY_STATS };
    const keyIndicators = fromSettled(keyIndicatorsResult, "keyIndicators");
    const news = fromSettled(newsResult, "news");
    const profile = fromSettled(profileResult, "profile");
    const annualSeries = fromSettled(annualResult, "fundamentalsAnnual");
    const quarterlySeries = fromSettled(quarterlyResult, "fundamentalsQuarterly");
    const peersCompareRows = fromSettled(peersResult, "peers");

    return {
      ...base,
      keyStatsBundle,
      keyIndicators,
      news: Array.isArray(news) ? news : [],
      profile: profile ?? null,
      fundamentalsSeriesAnnual: annualSeries?.points ?? [],
      fundamentalsSeriesQuarterly: quarterlySeries?.points ?? [],
      fundamentalsTtmPoint: annualSeries?.ttmPoint ?? null,
      peersCompareRows: Array.isArray(peersCompareRows) ? peersCompareRows : [],
    };
  })();

  return { aboveFold, full };
}

/** Full SSR fan-out (no Supabase asset snapshot). Used by traffic probes. */
export async function loadStockPageInitialDataUncached(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  const now = new Date();
  const range: StockChartRange = DEFAULT_OVERVIEW_RANGE;

  if (isSingleAssetMode()) {
    if (!isSupportedAsset(ticker)) return null;
    return loadNvdaFixturePage(ticker, range);
  }

  try {
    return await startStockPageRebuild(ticker, now).full;
  } catch (err) {
    console.error("[loadStockPageInitialData] unexpected failure; serving fallback shell", { ticker, err });
    return fallbackStockPageInitialData(ticker, now);
  }
}

/**
 * Cold miss: return above-fold ASAP; keep fat arms running for snapshot persist.
 * Associates `forPersist` with the returned page via WeakMap for the single-flight leader.
 */
async function loadStockPageColdMissAboveFold(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  const now = new Date();
  if (isSingleAssetMode()) {
    if (!isSupportedAsset(ticker)) return null;
    return loadNvdaFixturePage(ticker, DEFAULT_OVERVIEW_RANGE);
  }

  try {
    const handle = startStockPageRebuild(ticker, now);
    const page = await handle.aboveFold;
    coldMissFullByPage.set(page, handle.full);
    return page;
  } catch (err) {
    console.error("[loadStockPageInitialData] cold slim failure; serving fallback shell", { ticker, err });
    return fallbackStockPageInitialData(ticker, now);
  }
}

async function resolveStockPageForPersist(page: StockPageInitialData): Promise<StockPageInitialData> {
  const full = coldMissFullByPage.get(page);
  if (!full) return page;
  try {
    return await full;
  } catch (err) {
    console.warn("[loadStockPageInitialData] fat persist enrich failed; writing slim shell", {
      ticker: page.ticker,
      err,
    });
    return page;
  } finally {
    coldMissFullByPage.delete(page);
  }
}

/**
 * P5: shared per-ticker snapshot in Supabase (`market_snapshot` key `asset_{TICKER}`).
 * Miss → distributed single-flight rebuild (one uncached load per ticker/segment); hit →
 * return snapshot immediately (live + frozen). Client refreshes 1D chart, live spot, and
 * Key Indicators — avoids stalling soft-nav on EODHD hot fields.
 *
 * Cold miss (slim SSR): HTML returns above-fold first; fat sections finish in the background
 * and are written into the snapshot so the next warm hit still paints news/stats/etc.
 */
export async function loadStockPageInitialData(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  if (isSingleAssetMode()) {
    return loadStockPageInitialDataUncached(ticker);
  }

  const epoch = getScreenerUsMarketCacheEpoch();
  // Prefer exact segment; fall back to a fresh-enough prior segment so sparse-traffic tickers
  // (NFLX, screener page 3+) skip a full EODHD fan-out on every 15m roll.
  const cachedHit = await readAssetSnapshotForPage(ticker, epoch.segment, { allowStale: true });

  if (cachedHit?.payload?.ticker === ticker) {
    const base = assetSnapshotPayloadToPageData(cachedHit.payload);
    // Live and frozen: paint from snapshot immediately.
    // Live snapshots store empty 1D points + null spot/KI by design (`stripAssetSnapshotHotFields`);
    // StockPageContent + PriceChart + KeyIndicators refresh those via existing APIs (cached / single-flight).
    // Do not await hot chart/spot/KI here — that stalled screener → asset soft-nav.
    if (!cachedHit.exactSegment) {
      scheduleAssetSnapshotWrite(ticker, epoch.segment, base, epoch.mode);
    }
    return base;
  }

  const snapKey = assetSnapshotKey(ticker);
  if (!snapKey) return fallbackStockPageInitialData(ticker, new Date());

  return runAssetColdMissSingleFlight<StockPageInitialData>({
    snapshotKey: snapKey,
    ticker,
    segment: epoch.segment,
    mode: epoch.mode,
    tryAcquire: (ownerId) =>
      tryAcquireAssetRebuildLease(snapKey, epoch.segment, ownerId, ASSET_REBUILD_LEASE_TTL_SEC),
    release: (ownerId) => releaseAssetRebuildLease(snapKey, epoch.segment, ownerId),
    markFailed: (ownerId) => failAssetRebuildLease(snapKey, epoch.segment, ownerId),
    newOwnerId: newAssetRebuildLeaseOwner,
    loadUncached: () => loadStockPageColdMissAboveFold(ticker),
    persistSnapshot: async (page) => {
      const full = await resolveStockPageForPersist(page);
      return persistAssetSnapshotAwaited(ticker, epoch.segment, full, epoch.mode);
    },
    readSnapshot: () => readAssetSnapshotForPage(ticker, epoch.segment, { allowStale: true }),
    pageFromSnapshot: async (hit) => {
      // Waiter / coalesced path — no EODHD hot refresh.
      return assetSnapshotPayloadToPageData(hit.payload);
    },
    fallbackPage: () => fallbackStockPageInitialData(ticker, new Date()),
    sleep: sleepMs,
    now: () => Date.now(),
    waiterMaxMs: ASSET_REBUILD_WAITER_MAX_MS,
    pollMs: ASSET_REBUILD_WAITER_POLL_MS,
  });
}
