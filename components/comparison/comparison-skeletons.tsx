"use client";

import { SkeletonBox, LogoSkeleton } from "@/components/markets/skeleton";

const RETURN_COL_COUNT = 5;

function ComparisonTableRowSkeleton({
  gridTemplateColumns,
  cellSkeletonWidths,
}: {
  gridTemplateColumns: string;
  cellSkeletonWidths: string[];
}) {
  return (
    <div
      className="grid h-[60px] max-h-[60px] items-center gap-x-2 bg-white px-4"
      style={{ gridTemplateColumns }}
      aria-hidden
    >
      <div className="flex min-w-0 items-center gap-3 pr-4">
        <SkeletonBox className="h-4 w-1 shrink-0 rounded-full" />
        <LogoSkeleton sizeClass="h-8 w-8" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBox className="h-4 w-28 max-w-full rounded" />
          <SkeletonBox className="h-3 w-12 rounded" />
        </div>
      </div>
      {cellSkeletonWidths.map((w, i) => (
        <div key={i} className="flex min-w-0 justify-end">
          <SkeletonBox className={`h-4 rounded ${w}`} />
        </div>
      ))}
    </div>
  );
}

export function ComparisonFundamentalsTableSkeleton({
  rowCount = 1,
  gridTemplateColumns,
}: {
  rowCount?: number;
  gridTemplateColumns: string;
}) {
  const cellWidths = ["w-14", "w-16", "w-16", "w-16", "w-10", "w-14", "w-16"];
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <ComparisonTableRowSkeleton
          key={i}
          gridTemplateColumns={gridTemplateColumns}
          cellSkeletonWidths={cellWidths}
        />
      ))}
    </>
  );
}

export function ComparisonPerformanceTableSkeleton({
  rowCount = 1,
  gridTemplateColumns,
}: {
  rowCount?: number;
  gridTemplateColumns: string;
}) {
  const cellWidths = Array.from({ length: RETURN_COL_COUNT }, () => "w-14");
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <ComparisonTableRowSkeleton
          key={i}
          gridTemplateColumns={gridTemplateColumns}
          cellSkeletonWidths={cellWidths}
        />
      ))}
    </>
  );
}

export function ComparisonReturnChartSkeleton() {
  const totalH = 320;
  const plotH = 288;
  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden bg-white" aria-busy="true" aria-label="Loading return chart">
      <h3 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Return</h3>
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
