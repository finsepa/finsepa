import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";

function sym(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** SSR hot fields already include a usable live spot for the header. */
export function stockPageSsrHasLiveSpotSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  if (!data || data.ticker !== sym(ticker)) return false;
  const spot = data.headerLiveSpotUsd;
  return typeof spot === "number" && Number.isFinite(spot) && spot > 0;
}

/** SSR overview already includes a 1D chart series (skip client mount chart prime). */
export function stockPageSsrHas1DChartSeed(
  data: StockPageInitialData | null | undefined,
  ticker: string,
): boolean {
  if (!data || data.ticker !== sym(ticker)) return false;
  return data.chart.range === "1D" && data.chart.points.length >= 2;
}
