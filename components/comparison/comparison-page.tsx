"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ComparisonEmptyToolbar } from "@/components/comparison/comparison-empty-toolbar";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { isComparisonSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";

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
      <div className="relative space-y-5 px-9 py-6">
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
    <div className="space-y-6 px-9 py-6">
      <ComparisonEmptyToolbar tickers={tickersForUi} allowedChartingTickers={allowedChartingTickers} />

      <div className="flex w-full flex-col items-center pb-2 pt-0" aria-label="Chart area">
        <div className="relative w-full max-w-[min(100%,640px)]">
          <Image
            src="/charting-empty-hero.png"
            alt=""
            width={1024}
            height={517}
            className="h-auto w-full object-contain"
            priority
          />
        </div>

        <h2 className="mt-8 max-w-xl text-center text-xl font-semibold leading-8 tracking-tight text-[#09090B] sm:text-2xl sm:leading-9">
          Add at least one company to begin comparing
        </h2>
      </div>
    </div>
  );
}
