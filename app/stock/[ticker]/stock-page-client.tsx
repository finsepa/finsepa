"use client";

import type { ReactNode } from "react";

import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { StockPageContent } from "@/components/stock/stock-page-content";

export function StockPageClient({
  routeTicker,
  initialPageData,
  initialActiveTab,
  initialChartingMetric,
  overviewBelowFold,
  earningsPanel,
}: {
  routeTicker: string;
  initialPageData: StockPageInitialData;
  initialActiveTab: StockDetailTabId;
  initialChartingMetric: string | null;
  /** Server-streamed overview below-fold (KI / key stats / news). */
  overviewBelowFold?: ReactNode;
  /** Deep-link `?tab=earnings`: nested Suspense preview seed (client upgrades to full). */
  earningsPanel?: ReactNode;
}) {
  // `useSearchParams` lives in `SearchParamsBridge` inside StockPageContent so we
  // do not wrap the page in Suspense fallback={null} (blank main). Route `loading.tsx`
  // and the page-level Suspense share `StockPageSkeleton` while slim SSR streams.
  return (
    <StockPageContent
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
      initialChartingMetric={initialChartingMetric}
      overviewBelowFold={overviewBelowFold}
      earningsPanel={earningsPanel}
    />
  );
}
