"use client";

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
  // `useSearchParams` lives in `SearchParamsBridge` inside StockPageContent so we
  // do not wrap the page in Suspense fallback={null} (blank main) or a second
  // full-page skeleton. Route `loading.tsx` covers the wait for server data.
  return (
    <StockPageContent
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
      initialChartingMetric={initialChartingMetric}
    />
  );
}
