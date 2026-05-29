"use client";

import { SkeletonBox } from "@/components/markets/skeleton";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/** Typical annual columns shown (e.g. 2018–2025). */
const SKELETON_YEAR_COLUMNS = 8;

const SKELETON_DATA_ROWS = 10;

const gridTemplateColumns = `minmax(11rem, 2fr) repeat(${SKELETON_YEAR_COLUMNS}, minmax(5.25rem, 1fr))`;

const incomeHeaderRowClass = "min-h-[44px]";
const incomeDataRowClass = "min-h-[60px]";
const incomeRowDividerClass = "border-b border-[#E4E4E7]";

const headerLabelCellClass =
  "flex min-h-full min-w-0 items-center self-stretch border-r border-[#E4E4E7] pr-4";

const headerValueCellClass = "flex min-h-full min-w-0 items-center justify-end self-stretch";

const labelWidths = ["w-[72%]", "w-[55%]", "w-[80%]", "w-[64%]", "w-[88%]", "w-[70%]", "w-[76%]", "w-[60%]", "w-[68%]", "w-[74%]"];

const valueWidths = ["w-12", "w-14", "w-10", "w-12", "w-14", "w-10", "w-12", "w-14"];

/** Grid skeleton matching {@link StockIncomeStatementTable} (Fiscal Year / Period Ending + data rows). */
export function FinancialsTableSkeleton() {
  return (
    <ScreenerTableScroll mobileScroll viewportScroll>
      <div className="bg-white" aria-hidden>
        <div className={SCREENER_TABLE_HEADER_STICKY_CLASS}>
          <div
            className={cn(
              "grid items-stretch gap-x-2 border-b border-[#E4E4E7] px-2 py-0 sm:px-4",
              incomeHeaderRowClass,
            )}
            style={{ gridTemplateColumns }}
          >
            <div className={headerLabelCellClass}>
              <SkeletonBox className="h-3.5 w-20 rounded" />
            </div>
            {Array.from({ length: SKELETON_YEAR_COLUMNS }).map((_, i) => (
              <div key={`fy-${i}`} className={headerValueCellClass}>
                <SkeletonBox className="h-3.5 w-10 rounded" />
              </div>
            ))}
          </div>
          <div
            className={cn(
              "grid items-stretch gap-x-2 border-b border-[#E4E4E7] px-2 py-0 sm:px-4",
              incomeHeaderRowClass,
            )}
            style={{ gridTemplateColumns }}
          >
            <div className={headerLabelCellClass}>
              <SkeletonBox className="h-3.5 w-24 rounded" />
            </div>
            {Array.from({ length: SKELETON_YEAR_COLUMNS }).map((_, i) => (
              <div key={`pe-${i}`} className={headerValueCellClass}>
                <SkeletonBox className="h-3.5 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>

        {Array.from({ length: SKELETON_DATA_ROWS }).map((_, ri) => (
          <div
            key={ri}
            className={cn(
              "grid items-stretch gap-x-2 bg-white px-2 sm:px-4",
              incomeRowDividerClass,
              incomeDataRowClass,
            )}
            style={{ gridTemplateColumns }}
          >
            <div className={cn(headerLabelCellClass, "items-center")}>
              <SkeletonBox className={cn("h-4 rounded", labelWidths[ri % labelWidths.length])} />
            </div>
            {Array.from({ length: SKELETON_YEAR_COLUMNS }).map((_, ci) => (
              <div key={ci} className={headerValueCellClass}>
                <SkeletonBox
                  className={cn("h-4 rounded", valueWidths[(ri + ci) % valueWidths.length])}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScreenerTableScroll>
  );
}

/** Full Financials tab shell for `next/dynamic` and in-tab fetch loading. */
export function StockFinancialsTabSkeleton({ showToolbar = true }: { showToolbar?: boolean }) {
  return (
    <div className="space-y-4 pt-1" aria-busy="true" aria-label="Loading financials">
      {showToolbar ? (
        <>
          <div className="grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.88fr)_2.25rem] items-center gap-1.5 sm:hidden">
            <SkeletonBox className="h-9 w-full rounded-[10px]" />
            <SkeletonBox className="h-9 w-full rounded-[10px]" />
            <SkeletonBox className="h-9 w-full rounded-[10px]" />
            <SkeletonBox className="h-9 w-9 shrink-0 rounded-[10px]" />
          </div>
          <div className="hidden flex-col gap-3 sm:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <SkeletonBox className="h-10 w-[min(100%,20rem)] rounded-[10px]" />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SkeletonBox className="h-9 w-9 shrink-0 rounded-[10px]" />
              <SkeletonBox className="h-10 w-[11rem] rounded-[10px]" />
              <SkeletonBox className="h-10 w-[min(100%,16rem)] rounded-[10px]" />
            </div>
          </div>
        </>
      ) : null}
      <FinancialsTableSkeleton />
    </div>
  );
}
