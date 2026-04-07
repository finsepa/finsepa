import { Suspense } from "react";

import { ChartingPage } from "@/components/charting/charting-page";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isChartingSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";
import { isTop10Ticker } from "@/lib/screener/top10-config";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ChartingRoutePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const rawTickerParam = firstParam(sp.ticker)?.trim() ?? "";
  const tickersParsed = parseChartingTickerList(rawTickerParam || null);
  const metricParam = firstParam(sp.metric) ?? null;

  const allowedTickers = tickersParsed.filter((t) =>
    isSingleAssetMode() ? isSupportedAsset(t) : isTop10Ticker(t),
  );

  const urlSaysChart = isChartingSessionReady(allowedTickers, metricParam);

  const initialByTicker: Record<string, StockPageInitialData> = {};
  if (urlSaysChart) {
    const loaded = await Promise.all(
      allowedTickers.map(async (t) => ({ t, d: await loadStockPageInitialData(t) })),
    );
    for (const { t, d } of loaded) {
      if (d && d.ticker === t) initialByTicker[t] = d;
    }
  }

  /** URL has ticker(s) + metric(s). Do not require SSR preload — workspaces fetch fundamentals client-side if needed. */
  const chartSessionReady = urlSaysChart;

  return (
    <Suspense fallback={<div className="min-h-[40vh] px-9 py-6" aria-hidden />}>
      <ChartingPage
        tickers={allowedTickers}
        metricParam={metricParam}
        initialByTicker={initialByTicker}
        chartReady={chartSessionReady}
      />
    </Suspense>
  );
}
