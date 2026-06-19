"use client";

import { publicPortfolioViewTabs } from "@/components/portfolio/portfolio-page-tabs";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { cn } from "@/lib/utils";

const METRIC_CARD_CLASS =
  "flex flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] sm:px-4 sm:py-4";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-neutral-200", className)} aria-hidden />;
}

function OverviewMetricCardSkeleton() {
  return (
    <div className={METRIC_CARD_CLASS} aria-hidden>
      <Pulse className="h-3 w-14 bg-neutral-200" />
      <Pulse className="mt-1 h-8 w-[min(100%,11rem)] max-w-full rounded-md" />
      <Pulse className="mt-1 h-4 w-24 bg-neutral-100" />
    </div>
  );
}

function PortfolioOverviewCardsSkeleton() {
  return (
    <div className="mb-4 w-full min-w-0 sm:mb-6">
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Pulse className="h-3 w-10 bg-neutral-200" />
            <Pulse className="mt-2 h-8 w-[min(100%,14rem)] max-w-full rounded-md" />
            <Pulse className="h-4 w-36 bg-neutral-100" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Pulse className="h-9 w-9 rounded-[10px] bg-neutral-100" />
            <Pulse className="h-9 w-9 rounded-[10px] bg-neutral-100" />
          </div>
        </div>
        <div className="mt-4 space-y-0">
          <div className="flex items-center justify-between gap-4 py-3">
            <Pulse className="h-4 w-20 bg-neutral-100" />
            <Pulse className="h-4 w-16 bg-neutral-100" />
          </div>
          <div className="flex items-center justify-between gap-4 pb-0.5">
            <Pulse className="h-4 w-16 bg-neutral-100" />
            <Pulse className="h-4 w-24 bg-neutral-100" />
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4 sm:grid [&>*]:min-w-0">
        <OverviewMetricCardSkeleton />
        <OverviewMetricCardSkeleton />
        <OverviewMetricCardSkeleton />
        <OverviewMetricCardSkeleton />
      </div>
    </div>
  );
}

function PortfolioPageTabsSkeleton({ publicView = false }: { publicView?: boolean }) {
  const tabs = publicView
    ? [...publicPortfolioViewTabs]
    : (["Overview", "Performance", "Dividends", "Cash", "Transactions"] as const);

  return (
    <nav
      className="-mx-1 mb-6 flex gap-4 overflow-x-auto overflow-y-hidden border-b border-[#E4E4E7] pb-px [-webkit-overflow-scrolling:touch] sm:mx-0 sm:gap-6 sm:overflow-visible"
      aria-hidden
    >
      {tabs.map((label) => (
        <div key={label} className="mb-[-1px] shrink-0 pb-2">
          <Pulse
            className={cn(
              "h-4 rounded-sm",
              label === "Overview" ? "w-16" : label === "Transactions" ? "w-24" : "w-20",
              label === "Overview" ? "bg-neutral-300" : "bg-neutral-100",
            )}
          />
        </div>
      ))}
    </nav>
  );
}

function PortfolioChartControlsSkeleton() {
  return (
    <>
      <div className="mb-4 hidden w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:flex" aria-hidden>
        <Pulse className="h-9 w-[min(100%,18rem)] rounded-[10px] bg-[#F4F4F5]" />
        <div className="flex items-center gap-3">
          <Pulse className="h-9 w-9 rounded-[10px] bg-[#F4F4F5]" />
          <Pulse className="h-9 w-[min(100%,20rem)] rounded-[10px] bg-[#F4F4F5]" />
        </div>
      </div>
      <div className="mb-3 w-full sm:hidden" aria-hidden>
        <Pulse className="h-10 w-full rounded-[10px] bg-[#F4F4F5]" />
      </div>
    </>
  );
}

function PortfolioHoldingsSubTabsSkeleton() {
  return (
    <div className="mb-4 flex gap-2" aria-hidden>
      {["Assets", "Allocation", "Slices"].map((label, i) => (
        <Pulse
          key={label}
          className={cn("h-8 rounded-lg", i === 0 ? "w-16 bg-neutral-200" : "w-20 bg-neutral-100")}
        />
      ))}
    </div>
  );
}

function PortfolioHoldingsTableSkeleton() {
  return (
    <div className="w-full min-w-0" aria-hidden>
      <div className="hidden border-t border-[#E4E4E7] sm:grid sm:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] sm:gap-4 sm:px-0 sm:py-3">
        {["Asset", "Price", "Holdings", "Avg. Buy Price", "Profit/Loss", "Weight"].map((label) => (
          <Pulse key={label} className="h-3 w-16 bg-neutral-100" />
        ))}
      </div>

      <div className="divide-y divide-[#E4E4E7] sm:divide-none">
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-3 py-3 sm:grid sm:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] sm:items-center sm:gap-4 sm:py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-neutral-100" />
              <div className="min-w-0 space-y-2">
                <Pulse className="h-4 w-[min(100%,10rem)]" />
                <Pulse className="h-3 w-20 bg-neutral-100" />
              </div>
            </div>
            <div className="hidden sm:block">
              <Pulse className="ml-auto h-4 w-14 bg-neutral-100" />
            </div>
            <div className="hidden sm:block">
              <Pulse className="ml-auto h-4 w-16 bg-neutral-100" />
            </div>
            <div className="hidden sm:block">
              <Pulse className="ml-auto h-4 w-14 bg-neutral-100" />
            </div>
            <div className="hidden sm:block">
              <Pulse className="ml-auto h-4 w-16 bg-neutral-100" />
            </div>
            <div className="hidden sm:block">
              <Pulse className="ml-auto h-4 w-10 bg-neutral-100" />
            </div>
            <div className="shrink-0 text-right sm:hidden">
              <Pulse className="ml-auto h-4 w-16" />
              <Pulse className="mt-2 ml-auto h-3 w-24 bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioPageHeaderSkeleton({
  showPortfoliosBreadcrumb = false,
}: {
  showPortfoliosBreadcrumb?: boolean;
}) {
  return (
    <div
      className="mb-6 hidden shrink-0 flex-col gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      aria-hidden
    >
      <div className="min-w-0 flex-1">
        {showPortfoliosBreadcrumb ? (
          <Pulse className="h-8 w-[min(100%,12rem)] max-w-full rounded-lg" />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Pulse className="h-8 w-8 shrink-0 rounded-lg bg-neutral-100" />
            <Pulse className="h-8 w-[min(100%,12rem)] max-w-full rounded-lg" />
            <Pulse className="h-9 w-9 shrink-0 rounded-[10px] bg-neutral-100" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Pulse className="h-9 w-9 rounded-[10px] bg-neutral-100" />
        <Pulse className="h-9 w-9 rounded-[10px] bg-neutral-100" />
      </div>
    </div>
  );
}

/**
 * Shared shell for `app/(protected)/portfolio/loading.tsx`, Suspense fallback,
 * and workspace hydration while holdings quotes refresh.
 */
export function PortfolioPageLoadingShell({
  publicView = false,
  showPortfoliosBreadcrumb = false,
}: {
  publicView?: boolean;
  showPortfoliosBreadcrumb?: boolean;
} = {}) {
  return (
    <div
      className="relative flex min-h-full min-w-0 flex-col overflow-x-hidden"
      aria-busy="true"
      aria-label="Loading portfolio"
    >
      {showPortfoliosBreadcrumb ? (
        <nav
          aria-hidden
          className="flex min-w-0 items-center px-4 py-3 max-md:border-b-0 md:border-b md:border-[#E4E4E7] sm:px-9"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Pulse className="h-4 w-20 bg-neutral-100" />
            <Pulse className="h-4 w-1 bg-neutral-100" />
            <Pulse className="h-4 w-28 bg-neutral-100" />
          </div>
        </nav>
      ) : null}
      <div className="relative flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden px-4 py-4 sm:px-9 sm:py-6">
      <PortfolioPageHeaderSkeleton showPortfoliosBreadcrumb={showPortfoliosBreadcrumb} />
      <PortfolioOverviewCardsSkeleton />
      <PortfolioPageTabsSkeleton publicView={publicView} />

      <section className="mb-6 w-full min-w-0" aria-hidden>
        <PortfolioChartControlsSkeleton />
        <AssetChartSkeleton />
      </section>

      <div className="pt-6" aria-hidden>
        <PortfolioHoldingsSubTabsSkeleton />
        <PortfolioHoldingsTableSkeleton />
      </div>
      </div>
    </div>
  );
}

/** Shown while lazy tab panels (Cash / Transactions) load their JS chunk. */
export function PortfolioTabPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-h-[min(50vh,420px)] rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
        className,
      )}
      aria-hidden
    >
      <Pulse className="h-5 w-40" />
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Pulse key={i} className="h-12 w-full rounded-lg bg-[#F4F4F5]" />
        ))}
      </div>
    </div>
  );
}
