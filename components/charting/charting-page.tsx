"use client";

import { Suspense, useMemo } from "react";
import { LineChart } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ChartingEmptyToolbar } from "@/components/charting/charting-empty-toolbar";
import { ChartingFullPageTab } from "@/components/charting/charting-full-page-tab";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import {
  isChartingSessionReady,
  parseChartingMetricsParam,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";
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

  /** Live URL wins over RSC props so `router.replace` to a full session always shows the chart. */
  const searchKey = searchParams.toString();
  const { sessionReady, allowedTickers, metricForRoute } = useMemo(() => {
    const raw = searchParams.get("ticker")?.trim() ?? "";
    const m = searchParams.get("metric");
    const parsed = parseChartingTickerList(raw || null);
    const allowed = parsed.filter((t) => {
      if (isSingleAssetMode()) return isSupportedAsset(t);
      return chartingAllowSet.has(t.trim().toUpperCase());
    });
    const ready = isChartingSessionReady(allowed, m);
    return { sessionReady: ready, allowedTickers: allowed, metricForRoute: m };
  }, [searchParams, searchKey, chartingAllowSet]);

  const showWorkspace =
    sessionReady ||
    (chartReady && tickers.length > 0 && parseChartingMetricsParam(metricParam).length > 0);
  const tickersForUi = allowedTickers.length > 0 ? allowedTickers : tickers;
  const metricForUi = metricForRoute ?? metricParam;

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
      />

      <section aria-label="Chart area" className="w-full">
        <Empty variant="card" className="min-h-[min(50vh,420px)] w-full">
          <EmptyHeader className="gap-3">
            <EmptyMedia variant="icon">
              <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Select a metric and add a company to begin charting</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Add at least one metric and one company using the controls above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  );
}
