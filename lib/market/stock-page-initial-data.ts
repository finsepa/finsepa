import "server-only";

import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import {
  getStockSpotQuoteForApi,
  getStockChartPointsForApi,
  stockChartPointsFromDailyBars,
  synthesize1DSessionChartFromDailyBars,
} from "@/lib/market/stock-chart-data";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { STOCK_CHART_ALL_LOOKBACK_YEARS, type StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import { getStockNews } from "@/lib/market/stock-news";
import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
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
import { readAssetSnapshot, upsertAssetSnapshot } from "@/lib/market/asset-snapshot-store";
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
  if (range === "1D" && getUsEquityMarketSession(now) === "regular") return [];
  if (!sortedDailyBars.length) return [];
  if (range === "1D") {
    const session = synthesize1DSessionChartFromDailyBars(sortedDailyBars, now);
    if (session.length > 0) return session;
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
    news: [],
    profile: null,
    fundamentalsSeriesAnnual: [],
    fundamentalsSeriesQuarterly: [],
    fundamentalsTtmPoint: null,
    peersCompareRows: [],
    headerLiveSpotUsd: null,
    headerPriorCloseUsd: null,
    earningsTabPayload: null,
  };
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

function positiveUsd(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchRecentDailyBarsForChartFallback(
  ticker: string,
  now: Date,
): Promise<EodhdDailyBar[]> {
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 21);
  const bars = await fetchEodhdEodDaily(ticker, ymdUtc(fromDate), ymdUtc(now));
  if (!bars?.length) return [];
  return [...bars].sort((a, b) => a.date.localeCompare(b.date));
}

async function loadStockPageHotFields(
  ticker: string,
  range: StockChartRange,
  sortedDailyFallback: EodhdDailyBar[],
  now: Date,
): Promise<Pick<StockPageInitialData, "chart" | "headerLiveSpotUsd" | "headerPriorCloseUsd">> {
  const [chartPointsResult, spotResult] = await Promise.allSettled([
    getStockChartPointsForApi(ticker, range, "price"),
    getStockSpotQuoteForApi(ticker),
  ]);
  const chartPointsRaw = fromSettled(chartPointsResult, "chart1D");
  const spotQuote = fromSettled(spotResult, "headerLiveSpot");

  let dailyBars = sortedDailyFallback;
  let points = resolveOverviewChartPoints(range, chartPointsRaw, dailyBars, now);
  if (range === "1D" && points.length === 0) {
    if (!dailyBars.length) {
      dailyBars = await fetchRecentDailyBarsForChartFallback(ticker, now);
    }
    points = resolveOverviewChartPoints(range, chartPointsRaw, dailyBars, now);
  }

  const liveSessionMinute =
    range === "1D" && getUsEquityMarketSession(now) === "regular";

  return {
    chart: { range, points, liveSessionMinute },
    headerLiveSpotUsd: positiveUsd(spotQuote?.price),
    headerPriorCloseUsd: positiveUsd(spotQuote?.previousClose),
  };
}

/**
 * One EOD daily fetch (same lookback as chart `ALL` / performance) powers overview chart + mini-table together.
 * Header + key-stats share one fundamentals fetch inside their respective loaders (bundle pulls once and passes root to sections).
 */
/** Full SSR fan-out (no Supabase asset snapshot). Used by traffic probes. */
export async function loadStockPageInitialDataUncached(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  const from = ymdUtc(fromDate);

  const range: StockChartRange = DEFAULT_OVERVIEW_RANGE;

  if (isSingleAssetMode()) {
    if (!isSupportedAsset(ticker)) return null;
    // Single-asset NVDA mode: avoid broad EODHD calls (serve one deterministic fixture).
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
      news: getNvdaStockNews(),
      profile: getNvdaProfile(),
      fundamentalsSeriesAnnual: getNvdaChartingSeriesPoints("annual"),
      fundamentalsSeriesQuarterly: getNvdaChartingSeriesPoints("quarterly"),
      fundamentalsTtmPoint: null,
      peersCompareRows: [],
      headerLiveSpotUsd,
      headerPriorCloseUsd: null,
      earningsTabPayload: null,
    };
  }

  try {
    const [
      headerMetaResult,
      barsResult,
      chartPointsResult,
      keyStatsResult,
      newsResult,
      profileResult,
      annualResult,
      quarterlyResult,
      peersResult,
      spotResult,
    ] = await Promise.allSettled([
      getStockDetailHeaderMetaForPage(ticker),
      fetchEodhdEodDaily(ticker, from, to),
      getStockChartPointsForApi(ticker, range, "price"),
      buildStockKeyStatsBundle(ticker),
      getStockNews(ticker),
      fetchEodhdStockProfile(ticker),
      fetchChartingSeries(ticker, "annual"),
      fetchChartingSeries(ticker, "quarterly"),
      getPeersCompareRowsCached(ticker),
      getStockSpotQuoteForApi(ticker),
    ]);

    const headerMeta = fromSettled(headerMetaResult, "headerMeta") ?? headerMetaShell(ticker);
    const barsRaw = fromSettled(barsResult, "eodDaily");
    const chartPointsRaw = fromSettled(chartPointsResult, "chart1D");
    const keyStatsBundle = fromSettled(keyStatsResult, "keyStats") ?? { ...EMPTY_KEY_STATS };
    const news = fromSettled(newsResult, "news");
    const profile = fromSettled(profileResult, "profile");
    const annualSeries = fromSettled(annualResult, "fundamentalsAnnual");
    const quarterlySeries = fromSettled(quarterlyResult, "fundamentalsQuarterly");
    const peersCompareRows = fromSettled(peersResult, "peers");
    const spotQuote = fromSettled(spotResult, "headerLiveSpot");

    const sorted = barsRaw?.length ? [...barsRaw].sort((a, b) => a.date.localeCompare(b.date)) : [];
    const performance = computeStockPerformanceFromSortedDailyBars(sorted, ticker, now);
    const points = resolveOverviewChartPoints(range, chartPointsRaw, sorted, now);

    return {
      ticker,
      isEtf: isStockDetailEtf(ticker, headerMeta),
      headerMeta,
      chart: { range, points },
      performance,
      keyStatsBundle,
      news: Array.isArray(news) ? news : [],
      profile: profile ?? null,
      fundamentalsSeriesAnnual: annualSeries?.points ?? [],
      fundamentalsSeriesQuarterly: quarterlySeries?.points ?? [],
      fundamentalsTtmPoint: annualSeries?.ttmPoint ?? null,
      peersCompareRows: Array.isArray(peersCompareRows) ? peersCompareRows : [],
      headerLiveSpotUsd: positiveUsd(spotQuote?.price),
      headerPriorCloseUsd: positiveUsd(spotQuote?.previousClose),
      earningsTabPayload: null,
    };
  } catch (err) {
    console.error("[loadStockPageInitialData] unexpected failure; serving fallback shell", { ticker, err });
    return fallbackStockPageInitialData(ticker, now);
  }
}

/**
 * P5: shared per-ticker snapshot in Supabase (`market_snapshot` key `asset_{TICKER}`).
 * Miss → full EODHD fan-out once per segment; hit → refresh 1D chart + live spot only (live session).
 */
export async function loadStockPageInitialData(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  if (isSingleAssetMode()) {
    return loadStockPageInitialDataUncached(ticker);
  }

  const epoch = getScreenerUsMarketCacheEpoch();
  const cached = await readAssetSnapshot(ticker, epoch.segment);

  if (cached?.ticker === ticker) {
    const base = assetSnapshotPayloadToPageData(cached);
    if (epoch.mode === "frozen" && base.chart.points.length > 0) {
      return base;
    }
    const hot = await loadStockPageHotFields(ticker, base.chart.range, [], new Date());
    return {
      ...base,
      ...hot,
      chart: hot.chart.points.length > 0 ? hot.chart : base.chart,
    };
  }

  const fresh = await loadStockPageInitialDataUncached(ticker);
  if (fresh) {
    scheduleAssetSnapshotWrite(ticker, epoch.segment, fresh, epoch.mode);
  }
  return fresh;
}
