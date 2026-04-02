import "server-only";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { sliceStockChartPointsForRange } from "@/lib/market/stock-chart-api";
import { stockChartPointsFromDailyBars } from "@/lib/market/stock-chart-data";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import { getStockNews } from "@/lib/market/stock-news";
import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";
import { fetchEodhdStockProfile } from "@/lib/market/eodhd-stock-profile";
import { getNvdaChartPoints, getNvdaHeaderMeta, getNvdaKeyStatsBundle, getNvdaPerformance } from "@/lib/fixtures/nvda";
import { getNvdaChartingSeriesPoints, getNvdaProfile, getNvdaStockNews } from "@/lib/fixtures/nvda";

export type StockPageInitialChart = {
  range: StockChartRange;
  points: StockChartPoint[];
};

export type StockPageInitialData = {
  ticker: string;
  headerMeta: StockDetailHeaderMeta;
  chart: StockPageInitialChart;
  performance: StockPerformance;
  keyStatsBundle: StockKeyStatsBundle;
  news: StockNewsArticle[];
  profile: StockProfilePayload | null;
  fundamentalsSeriesAnnual: ChartingSeriesPoint[];
  fundamentalsSeriesQuarterly: ChartingSeriesPoint[];
};

const DEFAULT_OVERVIEW_RANGE: StockChartRange = "1Y";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * One EOD daily fetch (12y) powers overview chart + mini-table performance together.
 * Header + key-stats share one fundamentals fetch inside their respective loaders (bundle pulls once and passes root to sections).
 */
export async function loadStockPageInitialData(routeTicker: string): Promise<StockPageInitialData | null> {
  const ticker = routeTicker.trim().toUpperCase();
  if (!ticker) return null;

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 12);
  const from = ymdUtc(fromDate);

  const range: StockChartRange = DEFAULT_OVERVIEW_RANGE;

  if (isSingleAssetMode()) {
    if (!isSupportedAsset(ticker)) return null;
    // Single-asset NVDA mode: avoid broad EODHD calls (serve one deterministic fixture).
    return {
      ticker,
      headerMeta: getNvdaHeaderMeta(),
      chart: { range, points: getNvdaChartPoints(range) },
      performance: getNvdaPerformance(),
      keyStatsBundle: getNvdaKeyStatsBundle(),
      news: getNvdaStockNews(),
      profile: getNvdaProfile(),
      fundamentalsSeriesAnnual: getNvdaChartingSeriesPoints("annual"),
      fundamentalsSeriesQuarterly: getNvdaChartingSeriesPoints("quarterly"),
    };
  }

  const [headerMeta, barsRaw, keyStatsBundle, news, profile, annualSeries, quarterlySeries] = await Promise.all([
    getStockDetailHeaderMetaForPage(ticker),
    fetchEodhdEodDaily(ticker, from, to),
    buildStockKeyStatsBundle(ticker),
    getStockNews(ticker),
    fetchEodhdStockProfile(ticker),
    fetchChartingSeries(ticker, "annual"),
    fetchChartingSeries(ticker, "quarterly"),
  ]);

  const sorted = barsRaw?.length ? [...barsRaw].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const performance = computeStockPerformanceFromSortedDailyBars(sorted, ticker, now);
  const rawPoints = stockChartPointsFromDailyBars(sorted);
  const points = sliceStockChartPointsForRange(rawPoints, range, now);

  return {
    ticker,
    headerMeta,
    chart: { range, points },
    performance,
    keyStatsBundle,
    news: Array.isArray(news) ? news : [],
    profile: profile ?? null,
    fundamentalsSeriesAnnual: annualSeries?.points ?? [],
    fundamentalsSeriesQuarterly: quarterlySeries?.points ?? [],
  };
}
