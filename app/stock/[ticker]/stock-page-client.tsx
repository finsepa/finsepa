"use client";

import { Suspense } from "react";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { StockPageContent } from "@/components/stock/stock-page-content";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";

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
    <Suspense fallback={<StockPageSkeleton />}>
      <StockPageContent
        routeTicker={routeTicker}
        initialPageData={initialPageData}
        initialActiveTab={initialActiveTab}
        initialChartingMetric={initialChartingMetric}
      />
    </Suspense>
  );
}
