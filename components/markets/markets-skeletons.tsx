"use client";

import { LogoSkeleton, SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";

/** Matches {@link ScreenerTable}: mobile hides star + 1M / YTD / M Cap / PE. */
const stocksColLayout =
  "grid-cols-[20px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] sm:gap-x-2";
const cryptoColLayout =
  "grid-cols-[20px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";
const indicesColLayout =
  "grid-cols-[20px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr] sm:gap-x-2";

/** Matches {@link IndexCards} — stacked label / value / change, no sparkline. */
export function IndexCardSkeleton({ name }: { name: string }) {
  return (
    <div className="flex min-h-[112px] w-[10.75rem] shrink-0 flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] md:w-auto md:min-w-0 md:shrink">
      <span className="text-[14px] font-medium leading-5 text-[#A1A1AA]">{name}</span>
      <SkeletonBox className="h-8 w-[7.5rem] max-w-full rounded-md" />
      <TextSkeleton wClass="w-14" hClass="h-3.5" />
    </div>
  );
}

function StocksRowSkeleton() {
  return (
    <div className={`grid ${stocksColLayout} min-h-[56px] items-center px-2 sm:min-h-[60px] sm:px-4`}>
      <div className="hidden w-10 shrink-0 items-center justify-center px-3 sm:flex">
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
    <ScreenerTableScroll>
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div className={`grid ${stocksColLayout} items-center px-2 py-3 sm:px-4 ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`flex ${
              i === 0 ? "hidden sm:flex"
              : i === 1 ? "justify-center"
              : i === 2 ? "justify-start"
              : "justify-end"
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
      <div className="hidden w-10 shrink-0 items-center justify-center px-3 sm:flex">
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
      <div className="hidden justify-end sm:flex">
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
    <ScreenerTableScroll>
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div
        className={`grid ${cryptoColLayout} min-h-[44px] items-center px-2 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4 ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}
      >
        <div className="hidden sm:block" aria-hidden />
        <div className="flex justify-center">
          <SkeletonBox className="h-3 w-4 rounded" />
        </div>
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-16 rounded" />
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
      <div className="hidden w-10 shrink-0 items-center justify-center px-3 sm:flex">
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
      <div className="hidden justify-end sm:flex">
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

function CryptoMoverCardSkeleton({ title }: { title: string }) {
  return (
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <span className="mb-3 text-[14px] font-medium leading-5 text-[#A1A1AA]">{title}</span>
      <div className="flex flex-1 flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <LogoSkeleton />
            <div className="min-w-0 flex-1 space-y-1.5">
              <TextSkeleton wClass="w-[55%] max-w-[140px]" />
              <TextSkeleton wClass="w-12" hClass="h-3" />
            </div>
            <TextSkeleton wClass="w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FearGreedCardSkeleton() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <SkeletonBox className="mb-3 h-4 w-32 rounded" />
      <SkeletonBox className="h-[120px] w-[120px] rounded-full" />
      <div className="mt-3">
        <TextSkeleton wClass="w-16" hClass="h-4" />
      </div>
    </div>
  );
}

/** Gainers & Losers sub-tab while `/api/screener/companies?gainersLosers=1` loads. */
export function StocksGainersLosersSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 h-5 w-36 rounded skeleton" />
        <StocksTableSkeleton rows={rows} />
      </div>
      <div>
        <div className="mb-3 h-5 w-36 rounded skeleton" />
        <StocksTableSkeleton rows={rows} />
      </div>
    </div>
  );
}

export type ScreenerMarketTabSkeletonVariant = "Stocks" | "Crypto" | "Indices" | "ETF's";

/** Shown while the server payload for the selected market tab is still loading. */
export function ScreenerMarketTabSkeleton({ tab }: { tab: ScreenerMarketTabSkeletonVariant }) {
  if (tab === "Crypto") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <div className="mb-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4">
          <CryptoMoverCardSkeleton title="Largest Gainers" />
          <CryptoMoverCardSkeleton title="Largest Losers" />
          <FearGreedCardSkeleton />
        </div>
        <CryptoTableSkeleton rows={10} />
      </div>
    );
  }

  if (tab === "Indices") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <IndicesTableSkeleton rows={10} />
      </div>
    );
  }

  if (tab === "ETF's") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <IndicesTableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="mb-6 -mx-4 overflow-x-auto overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"].map((name) => (
            <IndexCardSkeleton key={name} name={name} />
          ))}
        </div>
      </div>
      <div className="mb-5 h-10 w-48 rounded-lg skeleton" />
      <StocksTableSkeleton rows={10} />
    </div>
  );
}

export function IndicesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${indicesColLayout} min-h-[44px] items-center px-2 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4 ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}
      >
        <div className="hidden sm:block" aria-hidden />
        <div className="flex justify-center">
          <SkeletonBox className="h-3 w-4 rounded" />
        </div>
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-12 rounded" />
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
        <IndicesRowSkeleton key={i} />
      ))}
    </div>
  );
}

