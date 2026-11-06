"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { IndexBreadcrumbs } from "@/components/index/index-breadcrumbs";
import { IndexComponentsTable } from "@/components/index/index-components-table";
import { IndexHeader } from "@/components/index/index-header";
import { ChartControls } from "@/components/stock/chart-controls";
import { MiniTable } from "@/components/stock/mini-table";
import {
  ASSET_BREADCRUMB_CARD_CLASS,
  ASSET_HERO_CARD_CLASS,
  ASSET_PAGE_SHELL_CLASS,
} from "@/components/design-system/card-surface-styles";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import {
  INDEX_CHART_RANGES,
  type IndexChartRange,
  type IndexPageInitialData,
} from "@/lib/market/index-page-shared";
import { clearPendingAssetShellIfMatch } from "@/lib/navigation/pending-asset-shell";
import { usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
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

  useEffect(() => {
    if (serverMatch) clearPendingAssetShellIfMatch("index", symKey);
  }, [serverMatch, symKey]);

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

  const recentDailyCloses = serverMatch?.recentDailyCloses;
  const seedChartLastSec = serverMatch?.chart.points.at(-1)?.time ?? null;
  const headerUi = useMemo(() => {
    const now = new Date();
    let priorClose: number | null = null;
    let todaySpot: number | null = null;
    if (getUsEquityMarketSession(now) === "regular" && recentDailyCloses?.length) {
      const todayYmd = usSessionYmdFromUnixSeconds(Math.floor(now.getTime() / 1000));
      priorClose = recentDailyCloses.filter((b) => b.date < todayYmd).at(-1)?.close ?? null;
      // Some indices (NDX, DJI) have no intraday bars for today — the daily bar is the freshest price.
      const chartIsToday = seedChartLastSec != null && usSessionYmdFromUnixSeconds(seedChartLastSec) === todayYmd;
      if (!chartIsToday) todaySpot = recentDailyCloses.find((b) => b.date === todayYmd)?.close ?? null;
    }
    const merged = mergeSessionHeaderWithPerformanceSpot(
      sessionHeaderUi,
      performance,
      chartSeries,
      todaySpot,
      now,
      priorClose,
    );
    return todaySpot != null && !merged.isHovering && !merged.selectionActive
      ? { ...merged, priceTimestampLabel: null }
      : merged;
  }, [sessionHeaderUi, performance, chartSeries, recentDailyCloses, seedChartLastSec]);

  const initialChartMemo = useMemo(
    () => (serverMatch ? { range: serverMatch.chart.range, points: serverMatch.chart.points } : null),
    [serverMatch],
  );

  const periodLabel = range === "YTD" ? "YTD" : range;

  return (
    <div className="min-w-0 pb-10">
      <div className={ASSET_PAGE_SHELL_CLASS}>
        <div className={ASSET_BREADCRUMB_CARD_CLASS}>
          <IndexBreadcrumbs symbol={symKey} displayName={displayName} embedded />
        </div>

        <div className={ASSET_HERO_CARD_CLASS}>
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
        </div>

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
