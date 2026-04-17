"use client";

import { ChartSkeleton } from "@/components/ui/chart-skeleton";

/**
 * Shared shell for `app/(protected)/portfolio/loading.tsx` and Suspense fallback —
 * matches page chrome (header row, tabs strip, overview cards + chart placeholders).
 */
export function PortfolioPageLoadingShell() {
  return (
    <div className="flex min-h-full min-w-0 flex-col bg-white px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-6 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-8 w-[min(100%,14rem)] max-w-full animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-neutral-100" />
        </div>
        <div className="h-9 w-28 shrink-0 animate-pulse rounded-lg bg-neutral-100" />
      </div>

      <div className="-mx-1 mb-6 flex gap-4 overflow-x-auto overflow-y-hidden border-b border-[#E4E4E7] pb-px [-webkit-overflow-scrolling:touch] sm:mx-0 sm:gap-6 sm:overflow-visible sm:pb-0">
        {["Overview", "Performance", "Cash", "Transactions"].map((label) => (
          <div
            key={label}
            className="mb-[-1px] h-9 w-20 shrink-0 animate-pulse rounded-t-md bg-neutral-100 pb-2"
            aria-hidden
          />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <div
            key={k}
            className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]"
          >
            <div className="h-3 w-14 animate-pulse rounded bg-neutral-200" />
            <div className="mt-3 h-8 w-[min(100%,11rem)] max-w-full animate-pulse rounded-md bg-neutral-200" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>

      <div className="mb-6 w-full">
        <ChartSkeleton />
      </div>

      <div className="min-h-[200px] rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-md bg-neutral-50" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Shown while lazy tab panels (Cash / Transactions) load their JS chunk. */
export function PortfolioTabPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`min-h-[min(50vh,420px)] rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] ${className ?? ""}`}
      aria-hidden
    >
      <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#F4F4F5]" />
        ))}
      </div>
    </div>
  );
}
