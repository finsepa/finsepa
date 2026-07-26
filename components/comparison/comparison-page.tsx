"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { LineChart } from "@/lib/icons";
import { useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ComparisonEmptyToolbar } from "@/components/comparison/comparison-empty-toolbar";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { capComparisonTickers } from "@/lib/comparison/comparison-session";
import { isComparisonSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";
import { ChartLoadingIndicator } from "@/components/ui/chart-loading-indicator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const ComparisonWorkspace = dynamic(
  () => import("@/components/comparison/comparison-workspace").then((m) => m.ComparisonWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[min(50vh,420px)] w-full flex-col rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        <ChartLoadingIndicator className="min-h-0 flex-1" />
      </div>
    ),
  },
);

type Props = {
  tickers: string[];
  initialByTicker: Record<string, StockPageInitialData>;
  comparisonReady: boolean;
  allowedChartingTickers: string[];
};

/**
 * `/comparison` — empty hero until ≥1 company; chart uses a default metric in code and URL.
 */
export function ComparisonPage({
  initialByTicker,
  allowedChartingTickers,
}: Props) {
  const searchParams = useSearchParams();

  const chartingAllowSet = useMemo(
    () => new Set(allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [allowedChartingTickers],
  );

  const searchKey = searchParams.toString();
  const { sessionReady, allowedTickers } = useMemo(() => {
    const raw = searchParams.get("ticker")?.trim() ?? "";
    const parsed = parseChartingTickerList(raw || null);
    const allowed = parsed.filter((t) => {
      if (isSingleAssetMode()) return isSupportedAsset(t);
      return chartingAllowSet.has(t.trim().toUpperCase());
    });
    const capped = capComparisonTickers(allowed);
    return { sessionReady: isComparisonSessionReady(capped), allowedTickers: capped };
  }, [searchParams, searchKey, chartingAllowSet]);

  /** Workspace only when `?ticker=` is present — do not restore from localStorage on bare `/comparison`. */
  const showWorkspace = sessionReady;
  const tickersForUi = allowedTickers;

  if (showWorkspace) {
    return (
      <div className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
        <Suspense fallback={null}>
          <AssetPageTopLoader />
        </Suspense>
        <ComparisonWorkspace
          tickers={tickersForUi}
          initialByTicker={initialByTicker}
          allowedChartingTickers={allowedChartingTickers}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 px-4 py-4 sm:px-9 sm:py-6">
      <ComparisonEmptyToolbar tickers={tickersForUi} allowedChartingTickers={allowedChartingTickers} />

      <section aria-label="Comparison chart area" className="w-full">
        <Empty variant="card" className="min-h-[min(50vh,420px)] w-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No Data to Display</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Choose at least one company to generate your comparison.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  );
}
