"use client";

import { Suspense, useMemo } from "react";
import { LineChart } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ComparisonEmptyToolbar } from "@/components/comparison/comparison-empty-toolbar";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { isComparisonSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

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
  tickers,
  initialByTicker,
  comparisonReady,
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
    return { sessionReady: isComparisonSessionReady(allowed), allowedTickers: allowed };
  }, [searchParams, searchKey, chartingAllowSet]);

  const showWorkspace = sessionReady || (comparisonReady && tickers.length > 0);
  const tickersForUi = allowedTickers.length > 0 ? allowedTickers : tickers;

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
          <EmptyHeader className="gap-3">
            <EmptyMedia variant="icon">
              <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Add at least one company to begin comparing</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Add companies using the controls above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  );
}
