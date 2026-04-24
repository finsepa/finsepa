"use client";

import dynamic from "next/dynamic";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

/**
 * Client-only shell: `StockPageContent` uses `useSearchParams()`, which can SSR/hydrate
 * differently and break tab styles. `ssr: false` must live in a Client Component (not the
 * RSC `page.tsx`).
 */
const StockPageContentDynamic = dynamic(
  () => import("@/components/stock/stock-page-content").then((mod) => ({ default: mod.StockPageContent })),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6"
        aria-busy
        aria-label="Loading stock page"
      >
        <div className="space-y-3">
          <div className="h-9 w-44 animate-pulse rounded-md bg-neutral-100" />
          <div className="h-5 w-72 animate-pulse rounded-md bg-neutral-100" />
        </div>
        <div className="h-12 w-full max-w-xl animate-pulse rounded-md bg-neutral-100" />
        <div className="h-[min(420px,50vh)] w-full max-w-[1200px] animate-pulse rounded-lg bg-neutral-100" />
      </div>
    ),
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
      key={routeTicker}
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
    />
  );
}
