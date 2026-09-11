import { Suspense } from "react";
import { notFound } from "next/navigation";

import { StockEarningsTabLoading } from "@/components/stock/stock-earnings-tab-loading";
import { StockEarningsTabSeed } from "@/components/stock/stock-earnings-tab-seed";
import { StockOverviewBelowFold } from "@/components/stock/stock-overview-below-fold";
import { StockOverviewBelowFoldSkeleton } from "@/components/stock/stock-overview-below-fold-skeleton";
import { YieldForStreaming } from "@/components/stock/yield-for-streaming";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { normalizeStockDetailTab } from "@/lib/stock/stock-etf";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

import { StockPageClient } from "./stock-page-client";

/**
 * Async RSC child — awaited inside Suspense so `loading.tsx` / Suspense fallback
 * (StockPageSkeleton + pending soft-nav shell) can stream before slim SSR finishes.
 *
 * Nested Suspense: above-fold client shell streams first; below-fold (KI / stats / news)
 * and earnings preview (when `?tab=earnings`) yield once then stream — no extra EODHD
 * on the critical path beyond slim SSR.
 */
export async function StockPageData({
  routeTicker,
  tabFromUrl,
  initialChartingMetric,
}: {
  routeTicker: string;
  tabFromUrl: StockDetailTabId;
  initialChartingMetric: string | null;
}) {
  const initialPageData = await loadStockPageInitialData(routeTicker);
  if (!initialPageData) {
    notFound();
  }

  const initialActiveTab = normalizeStockDetailTab(tabFromUrl, initialPageData.isEtf);
  const ticker = initialPageData.ticker;

  return (
    <StockPageClient
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
      initialChartingMetric={initialChartingMetric}
      overviewBelowFold={
        <Suspense fallback={<StockOverviewBelowFoldSkeleton isEtf={initialPageData.isEtf} />}>
          <YieldForStreaming>
            <StockOverviewBelowFold
              ticker={ticker}
              isEtf={initialPageData.isEtf}
              keyIndicators={initialPageData.keyIndicators}
              keyStatsBundle={initialPageData.keyStatsBundle}
              news={initialPageData.news}
            />
          </YieldForStreaming>
        </Suspense>
      }
      earningsPanel={
        initialActiveTab === "earnings" ? (
          <Suspense fallback={<StockEarningsTabLoading />}>
            <YieldForStreaming>
              <StockEarningsTabSeed ticker={ticker} />
            </YieldForStreaming>
          </Suspense>
        ) : null
      }
    />
  );
}
