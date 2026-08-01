"use client";

import { SkeletonBox, LogoSkeleton } from "@/components/markets/skeleton";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

const RETURN_COL_COUNT = 5;

function ComparisonTableRowSkeleton({
  gridTemplateColumns,
  cellSkeletonWidths,
  showDivider,
  minWidthClass,
}: {
  gridTemplateColumns: string;
  cellSkeletonWidths: string[];
  showDivider?: boolean;
  minWidthClass: string;
}) {
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS} aria-hidden>
      <div className={cn(DEFAULT_TABLE_ROW_HOVER_PAD_CLASS, minWidthClass)}>
        <div
          className={cn(
            "grid h-[60px] max-h-[60px] w-full items-center gap-x-2",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
          style={{ gridTemplateColumns }}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-3 pr-4",
              TABLE_START_ALIGNED_PAD_CLASS,
            )}
          >
            <SkeletonBox className="h-4 w-1 shrink-0 rounded-full" />
            <LogoSkeleton sizeClass="h-8 w-8" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonBox className="h-4 w-28 max-w-full rounded" />
              <SkeletonBox className="h-3 w-12 rounded" />
            </div>
          </div>
          {cellSkeletonWidths.map((w, i) => (
            <div key={i} className={cn("flex min-w-0 justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
              <SkeletonBox className={`h-4 rounded ${w}`} />
            </div>
          ))}
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

export function ComparisonFundamentalsTableSkeleton({
  rowCount = 1,
  gridTemplateColumns,
  metricCount = 7,
  showDivider = false,
}: {
  rowCount?: number;
  gridTemplateColumns: string;
  metricCount?: number;
  showDivider?: boolean;
}) {
  const cellWidths = Array.from({ length: metricCount }, (_, i) =>
    ["w-14", "w-16", "w-16", "w-16", "w-10", "w-14", "w-16"][i % 7]!,
  );
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <ComparisonTableRowSkeleton
          key={i}
          gridTemplateColumns={gridTemplateColumns}
          cellSkeletonWidths={cellWidths}
          showDivider={i === 0 ? showDivider : showDivider && i < rowCount - 1}
          minWidthClass="min-w-[900px]"
        />
      ))}
    </>
  );
}

export function ComparisonPerformanceTableSkeleton({
  rowCount = 1,
  gridTemplateColumns,
  showDivider = false,
}: {
  rowCount?: number;
  gridTemplateColumns: string;
  showDivider?: boolean;
}) {
  const cellWidths = Array.from({ length: RETURN_COL_COUNT }, () => "w-14");
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <ComparisonTableRowSkeleton
          key={i}
          gridTemplateColumns={gridTemplateColumns}
          cellSkeletonWidths={cellWidths}
          showDivider={i === 0 ? showDivider : showDivider && i < rowCount - 1}
          minWidthClass="min-w-[720px]"
        />
      ))}
    </>
  );
}

export function ComparisonReturnChartSkeleton() {
  const totalH = 320;
  const plotH = 288;
  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden bg-surface" aria-busy="true" aria-label="Loading return chart">
      <h3 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-fg">Return</h3>
      <div className="px-2 sm:px-3" style={{ height: totalH }}>
        <SkeletonBox className="w-full rounded-md" style={{ height: plotH }} />
        <div className="mt-0 flex justify-between gap-2 pt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonBox key={i} className="h-3 flex-1 rounded" />
          ))}
        </div>
      </div>
    </section>
  );
}
