"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { LineChart } from "@/lib/icons";
import { useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ChartingEmptyToolbar } from "@/components/charting/charting-empty-toolbar";
import { ChartingFullPageTab } from "@/components/charting/charting-full-page-tab";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { filterChartingUrlTickersForSession } from "@/lib/charting/charting-allowed-tickers";
import {
  isChartingSessionReady,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";
import { ChartLoadingIndicator } from "@/components/ui/chart-loading-indicator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type Props = {
  tickers: string[];
  metricParam: string | null;
  initialByTicker: Record<string, StockPageInitialData>;
  /** Both company(ies) and metrics in URL (`isChartingSessionReady`). SSR preload optional; chart loads via client fetch if missing. */
  chartReady: boolean;
  /** Uppercase tickers allowed on Charting (top 10 + screener page 2); must match server URL filtering. */
  allowedChartingTickers: string[];
};

/**
 * Standalone Charting — blank hero until at least one ticker AND one metric are selected
 * (`isChartingSessionReady` on the server). No `loadStockPageInitialData` until then.
 */
export function ChartingPage({
  tickers,
  metricParam,
  initialByTicker,
  chartReady,
  allowedChartingTickers,
}: Props) {
  const searchParams = useSearchParams();

  const chartingAllowSet = useMemo(
    () =>
      new Set(
        allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean),
      ),
    [allowedChartingTickers],
  );

  /** Live URL wins over RSC props so `router.replace` / full-page loads always match the chart session. */
  const searchKey = searchParams.toString();
  const { sessionReady, allowedTickers, metricForUi } = useMemo(() => {
    const rawClient = searchParams.get("ticker")?.trim() ?? "";
    const fromClientUrl = parseChartingTickerList(rawClient || null);
    const tickerCandidates = fromClientUrl.length > 0 ? fromClientUrl : tickers;
    const allowed = filterChartingUrlTickersForSession(tickerCandidates, chartingAllowSet);

    const mClient = searchParams.get("metric")?.trim() ?? "";
    const mProps = metricParam?.trim() ?? "";
    const m = mClient || mProps || null;

    return {
      sessionReady: isChartingSessionReady(allowed, m),
      allowedTickers: allowed,
      metricForUi: mClient || mProps || null,
    };
  }, [searchParams, searchKey, chartingAllowSet, tickers, metricParam]);

  /** RSC `chartReady` covers first paint; client `sessionReady` covers soft navigations + hydration. */
  const showWorkspace = sessionReady || chartReady;
  const tickersForUi = allowedTickers.length > 0 ? allowedTickers : tickers;

  /** After picking a company from the empty toolbar, URL/RSC can lag 1–2 frames — show chart skeleton instead of the “add company” empty state. */
  const [pendingChartWorkspace, setPendingChartWorkspace] = useState(false);

  useEffect(() => {
    if (showWorkspace) setPendingChartWorkspace(false);
  }, [showWorkspace]);

  const onBeginChartSessionNavigation = useCallback(() => {
    setPendingChartWorkspace(true);
  }, []);

  if (showWorkspace) {
    return (
      <div className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
        <Suspense fallback={null}>
          <AssetPageTopLoader />
        </Suspense>
        <ChartingFullPageTab
          tickers={tickersForUi}
          metricParam={metricForUi ?? ""}
          initialByTicker={initialByTicker}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 px-4 py-4 sm:px-9 sm:py-6">
      <ChartingEmptyToolbar
        metricParam={metricForUi}
        tickers={tickersForUi}
        allowedChartingTickers={allowedChartingTickers}
        onBeginChartSessionNavigation={onBeginChartSessionNavigation}
      />

      <section
        aria-label={pendingChartWorkspace ? "Loading chart" : "Chart area"}
        className="w-full"
        aria-busy={pendingChartWorkspace}
      >
        {pendingChartWorkspace ? (
          <div className="flex min-h-[min(50vh,420px)] w-full flex-col rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <ChartLoadingIndicator className="min-h-0 flex-1" />
          </div>
        ) : (
          <Empty variant="card" className="min-h-[min(50vh,420px)] w-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Select a metric and add a company to begin charting</EmptyTitle>
              <EmptyDescription className="max-w-md">
                Add at least one metric and one company using the controls above.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}
