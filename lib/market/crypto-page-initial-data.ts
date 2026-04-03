import "server-only";

import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { getCryptoAsset } from "@/lib/market/crypto-asset";
import { getCryptoChartPoints } from "@/lib/market/crypto-chart-data";
import { getCryptoNews } from "@/lib/market/crypto-news";
import { getCryptoPerformance } from "@/lib/market/crypto-performance";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { isSingleAssetMode } from "@/lib/features/single-asset";

const DEFAULT_RANGE: StockChartRange = "1Y";

export type CryptoPageInitialData = {
  routeSymbol: string;
  asset: CryptoAssetRow | null;
  chart: { range: StockChartRange; points: StockChartPoint[] };
  performance: StockPerformance;
  news: StockNewsArticle[];
};

/**
 * Server pass for crypto detail: asset + chart + mini-table performance + news (aligned with stock page).
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
      performance: {
        ticker: raw.toUpperCase(),
        price: null,
        d1: null,
        d5: null,
        d7: null,
        m1: null,
        m6: null,
        ytd: null,
        y1: null,
        y5: null,
        all: null,
      },
      news: [],
    };
  }

  const [asset, points, performance, news] = await Promise.all([
    getCryptoAsset(raw),
    getCryptoChartPoints(raw, range),
    getCryptoPerformance(raw),
    getCryptoNews(raw),
  ]);

  return {
    routeSymbol: raw,
    asset,
    chart: { range, points },
    performance,
    news: Array.isArray(news) ? news : [],
  };
}
