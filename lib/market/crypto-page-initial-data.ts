import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { buildCryptoAssetRowFromDailyBars } from "@/lib/market/crypto-asset";
import { stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import { isCryptoLive1DSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { getCryptoNewsForPage } from "@/lib/market/crypto-news";
import {
  cryptoPageSnapshotToPageData,
  getCryptoPageCacheSegment,
  readCryptoPageSnapshot,
  stripCryptoPageSnapshotHotFields,
  upsertCryptoPageSnapshot,
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
  void upsertCryptoPageSnapshot(symbol, segment, payload).then((res) => {
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[crypto-page-snapshot] upsert failed", { symbol, reason: res.reason });
    }
  });
}

/** BTC: refresh minute/live 1D for header. Others: keep session empty (client live-price). */
async function loadCryptoPageHotFields(
  routeSymbol: string,
  closeSpotUsd: number | null,
): Promise<Pick<CryptoPageInitialData, "sessionChart" | "headerLiveSpotUsd">> {
  const live1d = isCryptoLive1DSymbol(routeSymbol);
  if (!live1d) {
    return {
      sessionChart: { range: SESSION_RANGE, points: [] },
      headerLiveSpotUsd:
        typeof closeSpotUsd === "number" && Number.isFinite(closeSpotUsd) && closeSpotUsd > 0
          ? closeSpotUsd
          : null,
    };
  }

  const now = new Date();
  const sessionPoints = await loadCryptoLive1DMinuteChartPoints(routeSymbol, now);
  const last =
    sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1]?.value : null;
  const spot =
    typeof last === "number" && Number.isFinite(last) && last > 0
      ? last
      : typeof closeSpotUsd === "number" && Number.isFinite(closeSpotUsd) && closeSpotUsd > 0
        ? closeSpotUsd
        : null;

  return {
    sessionChart: { range: SESSION_RANGE, points: sessionPoints },
    headerLiveSpotUsd: spot,
  };
}

/**
 * Server pass for crypto detail: one daily-bars fetch for asset + 1Y chart + performance.
 * Session 1D preload is BTC-only (live header chart); other symbols skip the extra intraday EODHD call.
 */
export async function loadCryptoPageInitialDataUncached(routeSymbol: string): Promise<CryptoPageInitialData> {
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
    getCryptoNewsForPage(raw),
  ]);

  const sorted = dailyBars?.length ? [...dailyBars].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const [asset, performance] = await Promise.all([
    buildCryptoAssetRowFromDailyBars(meta, sorted),
    Promise.resolve(computeStockPerformanceFromSortedDailyBars(sorted, meta.symbol, now)),
  ]);

  const chartPoints = stockChartPointsFromDailyBars(sorted, DEFAULT_RANGE, now);
  const closeSpot = lastPositiveCloseFromCryptoBars(sorted);
  const lastSession =
    sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1]?.value : null;
  const headerSpot =
    typeof lastSession === "number" && Number.isFinite(lastSession) && lastSession > 0
      ? lastSession
      : typeof closeSpot === "number" && Number.isFinite(closeSpot) && closeSpot > 0
        ? closeSpot
        : null;

  return {
    routeSymbol: raw,
    asset,
    chart: { range: DEFAULT_RANGE, points: chartPoints },
    sessionChart: { range: SESSION_RANGE, points: sessionPoints },
    performance,
    news: Array.isArray(news) ? news : [],
    headerLiveSpotUsd: headerSpot,
  };
}

const getCryptoPageInitialDataCached = unstable_cache(
  async (routeSymbol: string) => loadCryptoPageInitialDataUncached(routeSymbol),
  ["crypto-page-initial-v3-snapshot"],
  { revalidate: REVALIDATE_HOT },
);

/**
 * Prefer Supabase `asset_crypto_{SYM}` (stale OK up to 6h) so mid-traffic coins skip a cold
 * EODHD fan-out every 15m — same pattern as equity `asset_{TICKER}` for NVDA.
 */
export async function loadCryptoPageInitialData(routeSymbol: string): Promise<CryptoPageInitialData | null> {
  const raw = routeSymbol.trim();
  if (!raw) return null;

  if (isSingleAssetMode()) {
    return emptyPayload(raw);
  }

  const sym = raw.toUpperCase();
  const segment = getCryptoPageCacheSegment();
  const cachedHit = await readCryptoPageSnapshot(sym, segment, { allowStale: true });

  if (cachedHit?.payload?.routeSymbol?.trim().toUpperCase() === sym) {
    const base = cryptoPageSnapshotToPageData(cachedHit.payload);
    const closeFromPerf =
      typeof base.performance?.price === "number" &&
      Number.isFinite(base.performance.price) &&
      base.performance.price > 0
        ? base.performance.price
        : null;

    const needsHot =
      isCryptoLive1DSymbol(sym) ||
      !cachedHit.exactSegment ||
      base.headerLiveSpotUsd == null;

    if (!needsHot && base.chart.points.length > 0) {
      if (!cachedHit.exactSegment) {
        scheduleCryptoPageSnapshotWrite(sym, segment, base);
      }
      return base;
    }

    const hot = await loadCryptoPageHotFields(sym, closeFromPerf ?? base.headerLiveSpotUsd);
    const merged: CryptoPageInitialData = {
      ...base,
      ...hot,
      sessionChart:
        hot.sessionChart.points.length > 0 ? hot.sessionChart : base.sessionChart,
    };
    if (!cachedHit.exactSegment || hot.sessionChart.points.length > 0) {
      scheduleCryptoPageSnapshotWrite(sym, segment, merged);
    }
    return merged;
  }

  const fresh = await getCryptoPageInitialDataCached(sym);
  if (fresh?.asset || fresh?.chart.points.length) {
    scheduleCryptoPageSnapshotWrite(sym, segment, fresh);
  }
  return fresh;
}
