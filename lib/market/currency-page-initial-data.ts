import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { stockChartPointsFromDailyBars } from "@/lib/market/crypto-chart-data";
import {
  currencyDisplayCode,
  isCurrencyChartRange,
  isCurrencyPageSymbol,
  resolveCurrencyPageTitle,
  type CurrencyChartRange,
  type CurrencyPageInitialData,
} from "@/lib/market/currency-page-shared";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { emptyAnnualReturns } from "@/lib/market/stock-annual-returns";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import {
  STOCK_CHART_ALL_LOOKBACK_YEARS,
  type StockChartPoint,
  type StockChartRange,
} from "@/lib/market/stock-chart-types";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export {
  CURRENCY_CHART_RANGES,
  isCurrencyChartRange,
  type CurrencyChartRange,
  type CurrencyPageInitialData,
} from "@/lib/market/currency-page-shared";

const DEFAULT_RANGE: CurrencyChartRange = "1Y";

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

export async function getCurrencyChartPoints(
  symbol: string,
  range: StockChartRange,
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !isCurrencyChartRange(range)) return [];

  const to = ymdUtc(now);
  const fromDate = new Date(now);
  if (range === "ALL") {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  } else if (range === "5Y") {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  } else {
    fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 2);
  }
  const from = ymdUtc(fromDate);
  const bars = await fetchEodhdEodDaily(sym, from, to);
  if (!bars?.length) return [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  return stockChartPointsFromDailyBars(sorted, range, now);
}

async function loadCurrencyPageInitialDataUncached(routeSymbol: string): Promise<CurrencyPageInitialData> {
  const sym = routeSymbol.trim().toUpperCase();
  if (!sym || !isCurrencyPageSymbol(sym)) return emptyPayload(sym);
  if (isSingleAssetMode()) return emptyPayload(sym);

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);

  const bars = await fetchEodhdEodDaily(sym, from, to);
  const sorted = bars?.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const performance = computeStockPerformanceFromSortedDailyBars(sorted, sym, now);
  const chartPoints = stockChartPointsFromDailyBars(sorted, DEFAULT_RANGE, now);

  return {
    routeSymbol: sym,
    displayName: resolveCurrencyPageTitle(sym),
    displayCode: currencyDisplayCode(sym),
    chart: { range: DEFAULT_RANGE, points: chartPoints },
    performance,
  };
}

export const loadCurrencyPageInitialData = unstable_cache(
  loadCurrencyPageInitialDataUncached,
  ["currency-page-initial-v1"],
  { revalidate: REVALIDATE_HOT },
);
