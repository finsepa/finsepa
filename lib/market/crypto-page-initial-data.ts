import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { buildCryptoAssetRowFromDailyBars } from "@/lib/market/crypto-asset";
import { stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { isCryptoLive1DSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { getCryptoNews } from "@/lib/market/crypto-news";
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

/**
 * Server pass for crypto detail: one daily-bars fetch for asset + 1Y chart + performance.
 * Session 1D preload is BTC-only (live header chart); other symbols skip the extra intraday EODHD call.
 */
async function loadCryptoPageInitialDataUncached(routeSymbol: string): Promise<CryptoPageInitialData> {
  const raw = routeSymbol.trim();
  if (!raw) return emptyPayload("");

  if (isSingleAssetMode()) {
    return emptyPayload(raw);
  }

  const meta = await resolveCryptoMetaForProvider(raw);
  if (!meta) {
    return emptyPayload(raw);
  }

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);
  const live1d = isCryptoLive1DSymbol(raw);

  const [dailyBars, sessionPoints, news] = await Promise.all([
    fetchEodhdCryptoDailyBarsForMeta(meta, from, to),
    // BTC: preload minute/live 1D for the offscreen header chart.
    // Others: skip uncached intraday here — header uses daily close + client `/live-price`.
    live1d ? loadCryptoLive1DMinuteChartPoints(raw, now) : Promise.resolve([] as StockChartPoint[]),
    getCryptoNews(raw),
  ]);

  const sorted = dailyBars?.length ? [...dailyBars].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const [asset, performance] = await Promise.all([
    buildCryptoAssetRowFromDailyBars(meta, sorted),
    Promise.resolve(computeStockPerformanceFromSortedDailyBars(sorted, meta.symbol, now)),
  ]);

  const chartPoints = stockChartPointsFromDailyBars(sorted, DEFAULT_RANGE, now);
  const closeSpot = lastPositiveCloseFromCryptoBars(sorted);

  return {
    routeSymbol: raw,
    asset,
    chart: { range: DEFAULT_RANGE, points: chartPoints },
    sessionChart: { range: SESSION_RANGE, points: sessionPoints },
    performance,
    news: Array.isArray(news) ? news : [],
    headerLiveSpotUsd:
      typeof closeSpot === "number" && Number.isFinite(closeSpot) && closeSpot > 0 ? closeSpot : null,
  };
}

const getCryptoPageInitialDataCached = unstable_cache(
  async (routeSymbol: string) => loadCryptoPageInitialDataUncached(routeSymbol),
  ["crypto-page-initial-v2-lean-session"],
  { revalidate: REVALIDATE_HOT },
);

export async function loadCryptoPageInitialData(routeSymbol: string): Promise<CryptoPageInitialData | null> {
  const raw = routeSymbol.trim();
  if (!raw) return null;

  if (isSingleAssetMode()) {
    return emptyPayload(raw);
  }

  return getCryptoPageInitialDataCached(raw.toUpperCase());
}
