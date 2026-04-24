"use client";

import { LogoSkeleton, SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";

/** Matches {@link ScreenerTable}: mobile hides 1M / YTD / M Cap / PE. */
const stocksColLayout =
  "grid-cols-[40px_48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_96px]";
const cryptoColLayout =
  "grid-cols-[40px_48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr]";
const indicesColLayout =
  "grid-cols-[40px_48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr]";

/** Matches {@link IndexCards} — stacked label / value / change, no sparkline. */
export function IndexCardSkeleton({ name }: { name: string }) {
  return (
    <div className="flex min-h-[112px] flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <span className="text-[14px] font-medium leading-5 text-[#A1A1AA]">{name}</span>
      <SkeletonBox className="h-8 w-[7.5rem] max-w-full rounded-md" />
      <TextSkeleton wClass="w-14" hClass="h-3.5" />
    </div>
  );
}

function StocksRowSkeleton() {
  return (
    <div className={`grid ${stocksColLayout} min-h-[56px] items-center px-2 sm:min-h-[60px] sm:px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center justify-start gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[45%] max-w-[140px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`flex justify-end ${i >= 2 ? "hidden sm:flex" : ""}`}
        >
          <TextSkeleton wClass={i === 4 ? "w-10" : "w-12"} />
        </div>
      ))}
    </div>
  );
}

export function StocksTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ScreenerTableScroll minWidthClassName="min-w-0 sm:min-w-[720px] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div className={`grid ${stocksColLayout} items-center bg-white px-2 py-3 sm:px-4`}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`flex ${
              i === 0 || i === 1 ? "justify-center" : i === 2 ? "justify-start" : "justify-end"
            } ${i >= 5 ? "hidden sm:flex" : ""}`}
          >
            <SkeletonBox className="h-3 w-10 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <StocksRowSkeleton key={i} />
      ))}
      </div>
    </ScreenerTableScroll>
  );
}

function CryptoRowSkeleton() {
  return (
    <div className={`group grid min-h-[56px] ${cryptoColLayout} items-center bg-white px-2 sm:min-h-[60px] sm:px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center justify-start gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[40%] max-w-[160px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-16" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="hidden justify-end sm:flex">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="hidden justify-end sm:flex">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="hidden justify-end sm:flex">
        <TextSkeleton wClass="w-14" />
      </div>
    </div>
  );
}

export function CryptoTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ScreenerTableScroll minWidthClassName="min-w-0 sm:min-w-[720px] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div
        className={`grid ${cryptoColLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4`}
      >
        <div />
        <div className="flex justify-center">
          <SkeletonBox className="h-3 w-4 rounded" />
        </div>
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-16 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="hidden justify-end sm:flex">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="hidden justify-end sm:flex">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="hidden justify-end sm:flex">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <CryptoRowSkeleton key={i} />
      ))}
      </div>
    </ScreenerTableScroll>
  );
}

function IndicesRowSkeleton() {
  return (
    <div className={`group grid h-[60px] max-h-[60px] ${indicesColLayout} items-center bg-white px-2 sm:px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 justify-start px-2 sm:px-4">
        <TextSkeleton wClass="w-[45%] max-w-[180px]" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-20" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="hidden justify-end sm:flex">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="hidden justify-end sm:flex">
        <TextSkeleton wClass="w-12" />
      </div>
    </div>
  );
}

export function IndicesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${indicesColLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4`}
      >
        <div />
        <div className="flex justify-center">
          <SkeletonBox className="h-3 w-4 rounded" />
        </div>
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-12 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="hidden justify-end sm:flex">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="hidden justify-end sm:flex">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <IndicesRowSkeleton key={i} />
      ))}
    </div>
  );
}

