"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { CurrencyBreadcrumbs } from "@/components/currency/currency-breadcrumbs";
import { CurrencyHeader } from "@/components/currency/currency-header";
import { ChartControls } from "@/components/stock/chart-controls";
import { MiniTable } from "@/components/stock/mini-table";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import {
  CURRENCY_CHART_RANGES,
  type CurrencyChartRange,
  type CurrencyPageInitialData,
} from "@/lib/market/currency-page-shared";
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

function CurrencyPageContentInner({
  routeSymbol,
  initialData,
}: {
  routeSymbol: string;
  initialData?: CurrencyPageInitialData | null;
}) {
  const symKey = routeSymbol.trim().toUpperCase();
  const serverMatch =
    initialData != null && initialData.routeSymbol.trim().toUpperCase() === symKey ? initialData : null;

  const [range, setRange] = useState<CurrencyChartRange>(() => "1D");
  const [chartSeries, setChartSeries] = useState<StockChartSeries>("price");
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(EMPTY_CHART_DISPLAY);

  // Soft-nav between pairs can reuse this client tree — keep default 1D (no live).
  useEffect(() => {
    setRange("1D");
    setSessionHeaderUi(EMPTY_CHART_DISPLAY);
  }, [symKey]);

  const displayName = serverMatch?.displayName ?? symKey;
  const displayCode = serverMatch?.displayCode ?? symKey;
  const performance = serverMatch?.performance ?? null;

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
      <CurrencyBreadcrumbs displayName={displayName} />

      <div className="space-y-6 px-4 pt-4 sm:px-9 sm:pt-6">
        <CurrencyHeader
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
            if ((CURRENCY_CHART_RANGES as readonly string[]).includes(r)) {
              setRange(r as CurrencyChartRange);
            }
          }}
          availableRanges={CURRENCY_CHART_RANGES}
          hideMarketCapSeries
          chartSeries={chartSeries}
          onChartSeriesChange={setChartSeries}
        >
          <PriceChart
            kind="stock"
            symbol={symKey}
            range={range}
            series={chartSeries}
            // Proven: never SSR-seed 1Y (slows interaction). Seed only matching non-1Y.
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
      </div>
    </div>
  );
}

export function CurrencyPageContent({
  routeSymbol,
  initialData,
}: {
  routeSymbol: string;
  initialData?: CurrencyPageInitialData | null;
}) {
  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <CurrencyPageContentInner routeSymbol={routeSymbol} initialData={initialData} />
    </Suspense>
  );
}
