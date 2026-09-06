"use client";

import { Suspense } from "react";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { StockPageContent } from "@/components/stock/stock-page-content";

export function StockPageClient({
  routeTicker,
  initialPageData,
  initialActiveTab,
  initialChartingMetric,
}: {
  routeTicker: string;
  initialPageData: StockPageInitialData;
  initialActiveTab: StockDetailTabId;
  initialChartingMetric: string | null;
}) {
  return (
    // `useSearchParams` needs a boundary; do not remount the full-page skeleton
    // after RSC arrives (that felt like “stuck on loading” from screener clicks).
    // Route `loading.tsx` still covers the wait for server data.
    <Suspense fallback={null}>
      <StockPageContent
        routeTicker={routeTicker}
        initialPageData={initialPageData}
        initialActiveTab={initialActiveTab}
        initialChartingMetric={initialChartingMetric}
      />
    </Suspense>
  );
}
