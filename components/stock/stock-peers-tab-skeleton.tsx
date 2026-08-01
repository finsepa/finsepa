"use client";

import { ComparisonPageBar } from "@/components/comparison/comparison-page-bar";
import {
  ComparisonFundamentalsTableSkeleton,
  ComparisonPerformanceTableSkeleton,
  ComparisonReturnChartSkeleton,
} from "@/components/comparison/comparison-skeletons";
import { COMPARISON_DEFAULT_TABLE_METRIC_IDS } from "@/lib/comparison/comparison-table-metrics";
import { SkeletonBox } from "@/components/markets/skeleton";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

function fundamentalsGridColumns(metricCount: number): string {
  return `minmax(220px,1.4fr) repeat(${metricCount}, minmax(88px, 1fr))`;
}

function performanceGridColumns(): string {
  return `minmax(220px,1.4fr) repeat(5, minmax(72px, 1fr))`;
}

function PeersTableHeaderSkeleton({
  gridTemplateColumns,
  metricCount,
  minWidthClass,
}: {
  gridTemplateColumns: string;
  metricCount: number;
  minWidthClass: string;
}) {
  return (
    <div className={cn(SCREENER_TABLE_HEADER_STICKY_CLASS, SCREENER_TABLE_ROUNDED_HEADER_CLASS)} aria-hidden>
      <div
        className={cn("grid h-10 w-full items-center gap-x-2", minWidthClass)}
        style={{ gridTemplateColumns }}
      >
        <div className={cn("min-w-0", TABLE_START_ALIGNED_PAD_CLASS)}>
          <SkeletonBox className="h-3 w-16 rounded" />
        </div>
        {Array.from({ length: metricCount }).map((_, i) => (
          <div key={i} className={cn("flex min-w-0 justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
            <SkeletonBox className="h-3 w-14 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PeersRailSkeleton() {
  return (
    <aside
      className="hidden w-[240px] shrink-0 self-start rounded-2xl border border-stroke-subtle bg-surface p-4 md:block"
      aria-hidden
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <SkeletonBox className="h-4 w-20 rounded" />
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-8 w-8 rounded-full" />
            <SkeletonBox className="h-4 w-14 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          <SkeletonBox className="h-4 w-16 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonBox className="h-2.5 w-2.5 rounded-full" />
              <SkeletonBox className="h-3.5 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Full Peers tab shell for `dynamic` loading — mirrors tables + chart + desktop rail. */
export function StockPeersTabSkeleton() {
  const metricCount = COMPARISON_DEFAULT_TABLE_METRIC_IDS.length;
  const fundamentalsGrid = fundamentalsGridColumns(metricCount);
  const performanceGrid = performanceGridColumns();

  return (
    <div className="flex w-full min-w-0 flex-col gap-5" aria-busy="true" aria-label="Loading peers">
      <ComparisonPageBar title="Peers" showReset={false} />
      <div className="flex items-start gap-5">
        <div className="relative min-w-0 flex-1 space-y-5">
          <ScreenerTableScroll minWidthClassName="min-w-[900px]">
            <PeersTableHeaderSkeleton
              gridTemplateColumns={fundamentalsGrid}
              metricCount={metricCount}
              minWidthClass="min-w-[900px]"
            />
            <ComparisonFundamentalsTableSkeleton
              rowCount={1}
              gridTemplateColumns={fundamentalsGrid}
              metricCount={metricCount}
            />
          </ScreenerTableScroll>

          <ComparisonReturnChartSkeleton />

          <ScreenerTableScroll minWidthClassName="min-w-[720px]">
            <PeersTableHeaderSkeleton
              gridTemplateColumns={performanceGrid}
              metricCount={5}
              minWidthClass="min-w-[720px]"
            />
            <ComparisonPerformanceTableSkeleton rowCount={1} gridTemplateColumns={performanceGrid} />
          </ScreenerTableScroll>
        </div>
        <PeersRailSkeleton />
      </div>
    </div>
  );
}
