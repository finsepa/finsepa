import { Suspense } from "react";

import { ChartingPage } from "@/components/charting/charting-page";
import {
  buildChartingAllowedTickerList,
  filterChartingUrlTickersForSession,
} from "@/lib/charting/charting-allowed-tickers";
import { isChartingSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";

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

  const { universe } = await getScreenerCompaniesStaticLayer();
  const chartingEquityAllowlist = buildChartingAllowedTickerList(universe);
  const chartingAllowSet = new Set(chartingEquityAllowlist);

  const allowedTickers = filterChartingUrlTickersForSession(tickersParsed, chartingAllowSet);

  const urlSaysChart = isChartingSessionReady(allowedTickers, metricParam);

  /** P4: no SSR `loadStockPageInitialData` — chart workspace fetches `/fundamentals-series` per ticker on demand. */
  const initialByTicker = {};

  /** URL has ticker(s) + metric(s). Do not require SSR preload — workspaces fetch fundamentals client-side if needed. */
  const chartSessionReady = urlSaysChart;

  return (
    <Suspense fallback={<div className="min-h-[40vh] px-4 py-4 sm:px-9 sm:py-6" aria-hidden />}>
      <ChartingPage
        tickers={allowedTickers}
        metricParam={metricParam}
        initialByTicker={initialByTicker}
        chartReady={chartSessionReady}
        allowedChartingTickers={chartingEquityAllowlist}
      />
    </Suspense>
  );
}
