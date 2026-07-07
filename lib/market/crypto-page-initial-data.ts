import "server-only";

import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { buildCryptoAssetRowFromDailyBars } from "@/lib/market/crypto-asset";
import { fetchCryptoChartPointsUncached, stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { isCryptoLive1DSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { getCryptoNews } from "@/lib/market/crypto-news";
import { getCryptoLiveSpotPriceUsd } from "@/lib/market/crypto-live-price";
import { fetchEodhdCryptoDailyBarsForMeta } from "@/lib/market/eodhd-crypto";
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

export type CryptoPageInitialData = {
  routeSymbol: string;
  asset: CryptoAssetRow | null;
  chart: { range: StockChartRange; points: StockChartPoint[] };
  /** Preloaded 1D series for the offscreen header chart (avoids a heavy client fetch on first paint). */
  sessionChart: { range: StockChartRange; points: StockChartPoint[] };
  performance: StockPerformance;
  news: StockNewsArticle[];
  /** Phase 7: best-effort live USD spot for header fallback (see `getCryptoLiveSpotPriceUsd`). */
  headerLiveSpotUsd: number | null;
};

/**
 * Server pass for crypto detail: one daily-bars fetch for asset + 1Y chart + performance;
 * intraday 1D for header is loaded in parallel.
 */
export async function loadCryptoPageInitialData(routeSymbol: string): Promise<CryptoPageInitialData | null> {
  const raw = routeSymbol.trim();
  if (!raw) return null;

  const range = DEFAULT_RANGE;

  if (isSingleAssetMode()) {
    return {
      routeSymbol: raw,
      asset: null,
      chart: { range, points: [] },
      sessionChart: { range: SESSION_RANGE, points: [] },
      performance: emptyPerformance(raw),
      news: [],
      headerLiveSpotUsd: null,
    };
  }

  const meta = await resolveCryptoMetaForProvider(raw);
  if (!meta) {
    return {
      routeSymbol: raw,
      asset: null,
      chart: { range, points: [] },
      sessionChart: { range: SESSION_RANGE, points: [] },
      performance: emptyPerformance(raw),
      news: [],
      headerLiveSpotUsd: null,
    };
  }

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);

  const [dailyBars, sessionPoints, news, headerLiveSpotUsd] = await Promise.all([
    fetchEodhdCryptoDailyBarsForMeta(meta, from, to),
    isCryptoLive1DSymbol(raw)
      ? loadCryptoLive1DMinuteChartPoints(raw, now)
      : fetchCryptoChartPointsUncached(raw, SESSION_RANGE),
    getCryptoNews(raw),
    getCryptoLiveSpotPriceUsd(raw),
  ]);

  const sorted = dailyBars?.length ? [...dailyBars].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const [asset, performance] = await Promise.all([
    buildCryptoAssetRowFromDailyBars(meta, sorted),
    Promise.resolve(computeStockPerformanceFromSortedDailyBars(sorted, meta.symbol, now)),
  ]);

  const chartPoints = stockChartPointsFromDailyBars(sorted, range, now);

  return {
    routeSymbol: raw,
    asset,
    chart: { range, points: chartPoints },
    sessionChart: { range: SESSION_RANGE, points: sessionPoints },
    performance,
    news: Array.isArray(news) ? news : [],
    headerLiveSpotUsd:
      typeof headerLiveSpotUsd === "number" && Number.isFinite(headerLiveSpotUsd) && headerLiveSpotUsd > 0
        ? headerLiveSpotUsd
        : null,
  };
}
