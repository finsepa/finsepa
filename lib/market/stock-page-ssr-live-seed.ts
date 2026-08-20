import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { stockKeyStatsBundleHasContent } from "@/lib/market/stock-key-stats-bundle-types";
import type { StockKeyIndicatorsResponse } from "@/lib/market/stock-key-indicators-types";

function sym(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function pageDataForTicker(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): StockPageInitialData | null {
  if (!data || data.ticker !== sym(ticker)) return null;
  return data;
}

/** SSR hot fields already include a usable live spot for the header. */
export function stockPageSsrHasLiveSpotSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  const spot = page.headerLiveSpotUsd;
  return typeof spot === "number" && Number.isFinite(spot) && spot > 0;
}

/** SSR overview already includes a 1D chart series (skip client mount chart prime). */
export function stockPageSsrHas1DChartSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return page.chart.range === "1D" && page.chart.points.length >= 2;
}

/** SSR page payload includes usable performance for header / mini-table. */
export function stockPageSsrHasPerformanceSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  const p = page.performance?.price;
  return typeof p === "number" && Number.isFinite(p) && p > 0;
}

/** SSR includes a non-empty key-stats bundle — skip client mount fetch. */
export function stockPageSsrHasKeyStatsBundleSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return stockKeyStatsBundleHasContent(page.keyStatsBundle);
}

function isRenderableKeyIndicators(payload: StockKeyIndicatorsResponse | null | undefined): boolean {
  return (payload?.indicators?.length ?? 0) >= 2;
}

/** SSR includes key indicators — skip client mount fetch. */
export function stockPageSsrHasKeyIndicatorsSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return isRenderableKeyIndicators(page.keyIndicators);
}

/** SSR includes overview news rows — skip duplicate EODHD news fetch on mount. */
export function stockPageSsrHasNewsOverviewSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return Array.isArray(page.news) && page.news.length > 0;
}

function isFundamentalsSeriesSeed(points: ChartingSeriesPoint[] | undefined): boolean {
  return Array.isArray(points) && points.length > 0;
}

/** SSR includes annual fundamentals series for Financials / Charting. */
export function stockPageSsrHasFundamentalsAnnualSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return isFundamentalsSeriesSeed(page.fundamentalsSeriesAnnual);
}

/** SSR includes quarterly fundamentals series for Financials / Charting. */
export function stockPageSsrHasFundamentalsQuarterlySeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  const page = pageDataForTicker(data, ticker);
  if (!page) return false;
  return isFundamentalsSeriesSeed(page.fundamentalsSeriesQuarterly);
}
