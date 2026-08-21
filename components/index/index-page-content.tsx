"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { IndexBreadcrumbs } from "@/components/index/index-breadcrumbs";
import { IndexComponentsTable } from "@/components/index/index-components-table";
import { IndexHeader } from "@/components/index/index-header";
import { ChartControls } from "@/components/stock/chart-controls";
import { MiniTable } from "@/components/stock/mini-table";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import {
  INDEX_CHART_RANGES,
  type IndexChartRange,
  type IndexPageInitialData,
} from "@/lib/market/index-page-shared";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";

const EMPTY_CHART_DISPLAY: ChartDisplayState = {
  loading: true,
  empty: true,
  displayPrice: null,
  displayChangePct: null,
  displayChangeAbs: null,
  selectionChangeAbs: null,
  selectionChangePct: null,
  isHovering: false,
  selectionActive: false,
  periodLabelOverride: null,
  priceTimestampLabel: null,
  scrubPeriodLabel: null,
};

function IndexPageContentInner({
  routeSymbol,
  initialData,
}: {
  routeSymbol: string;
  initialData?: IndexPageInitialData | null;
}) {
  const symKey = routeSymbol.trim().toUpperCase();
  const serverMatch =
    initialData != null && initialData.routeSymbol.trim().toUpperCase() === symKey ? initialData : null;

  const [range, setRange] = useState<IndexChartRange>(() => "1D");
  const [chartSeries, setChartSeries] = useState<StockChartSeries>("price");
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(EMPTY_CHART_DISPLAY);

  // Soft-nav between indices can reuse this client tree — keep default 1D (no live).
  useEffect(() => {
    setRange("1D");
    setSessionHeaderUi(EMPTY_CHART_DISPLAY);
  }, [symKey]);

  const displayName = serverMatch?.displayName ?? symKey;
  const displayCode = serverMatch?.displayCode ?? symKey;
  const performance = serverMatch?.performance ?? null;
  const components = serverMatch?.components ?? [];
  const showComponents = serverMatch?.showComponents ?? false;

  const headerUi = useMemo(
    () => mergeSessionHeaderWithPerformanceSpot(sessionHeaderUi, performance, chartSeries, null),
    [sessionHeaderUi, performance, chartSeries],
  );

  const initialChartMemo = useMemo(
    () => (serverMatch ? { range: serverMatch.chart.range, points: serverMatch.chart.points } : null),
    [serverMatch],
  );

  const periodLabel = range === "YTD" ? "YTD" : range;

  return (
    <div className="min-w-0 pb-10">
      <IndexBreadcrumbs displayName={displayName} />

      <div className="space-y-6 px-4 pt-4 sm:px-9 sm:pt-6">
        <IndexHeader
          symbol={symKey}
          displayName={displayName}
          displayCode={displayCode}
          periodLabel={periodLabel}
          periodLabelOverride={headerUi.periodLabelOverride}
          chartRangeLabel={headerUi.selectionActive ? range : undefined}
          price={headerUi.displayPrice}
          changePct={headerUi.displayChangePct}
          changeAbs={headerUi.displayChangeAbs}
          selectionChangeAbs={headerUi.selectionChangeAbs}
          selectionChangePct={headerUi.selectionChangePct}
          chartLoading={headerUi.loading}
          chartEmpty={headerUi.empty}
          priceTimestampLabel={headerUi.priceTimestampLabel}
          scrubPeriodLabel={headerUi.scrubPeriodLabel}
          chartHovering={headerUi.isHovering}
          headerLoading={!serverMatch}
        />

        <ChartControls
          activeRange={range}
          onRangeChange={(r) => {
            if ((INDEX_CHART_RANGES as readonly string[]).includes(r)) {
              setRange(r as IndexChartRange);
            }
          }}
          availableRanges={INDEX_CHART_RANGES}
          hideMarketCapSeries
          chartSeries={chartSeries}
          onChartSeriesChange={setChartSeries}
        >
          <PriceChart
            kind="stock"
            symbol={symKey}
            range={range}
            series={chartSeries}
            // Proven on crypto: never SSR-seed 1Y (slows interaction). Seed only matching non-1Y.
            initialChart={
              range === "1Y"
                ? null
                : initialChartMemo?.range === range
                  ? initialChartMemo
                  : null
            }
            onDisplayChange={setSessionHeaderUi}
          />
        </ChartControls>

        <MiniTable
          ticker={displayCode}
          cryptoPrimary={{ displayName, logoUrl: "" }}
          initialPerformance={performance}
        />

        {showComponents ? (
          <IndexComponentsTable
            rows={components}
            title={symKey === "IWM.US" ? "Top holdings" : "Components"}
          />
        ) : null}
      </div>
    </div>
  );
}

export function IndexPageContent({
  routeSymbol,
  initialData,
}: {
  routeSymbol: string;
  initialData?: IndexPageInitialData | null;
}) {
  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <IndexPageContentInner routeSymbol={routeSymbol} initialData={initialData} />
    </Suspense>
  );
}
