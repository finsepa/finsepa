"use client";

import dynamic from "next/dynamic";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";

/**
 * Client-only shell: `StockPageContent` uses `useSearchParams()`, which can SSR/hydrate
 * differently and break tab styles. `ssr: false` must live in a Client Component (not the
 * RSC `page.tsx`).
 */
const StockPageContentDynamic = dynamic(
  () => import("@/components/stock/stock-page-content").then((mod) => ({ default: mod.StockPageContent })),
  {
    ssr: false,
    loading: () => <StockPageSkeleton />,
  },
);

export function StockPageClient({
  routeTicker,
  initialPageData,
  initialActiveTab,
}: {
  routeTicker: string;
  initialPageData: StockPageInitialData;
  initialActiveTab: StockDetailTabId;
}) {
  return (
    <StockPageContentDynamic
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
    />
  );
}
