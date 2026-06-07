"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Layers2, Settings } from "@/lib/icons";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { PortfolioQuickAddMenu } from "@/components/layout/portfolio-quick-add-menu";
import { ImportTransactionsModal } from "@/components/portfolio/import-transactions-modal";
import { PortfolioAllocationView } from "@/components/portfolio/portfolio-allocation-view";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
import { PortfolioSlicesView } from "@/components/portfolio/portfolio-slices-view";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";
import { PortfolioOverviewAthProvider } from "@/components/portfolio/portfolio-overview-ath-context";
import { PortfolioOverviewCards } from "@/components/portfolio/portfolio-overview-cards";
import {
  PortfolioPageLoadingShell,
  PortfolioTabPanelSkeleton,
} from "@/components/portfolio/portfolio-page-loading";
import {
  PortfolioPageTabs,
  type OverviewHoldingsSubTab,
  type PortfolioViewTab,
  overviewHoldingsSubTabFromSearchParam,
  portfolioViewTabFromSearchParam,
  searchParamFromOverviewHoldingsSubTab,
  searchParamFromPortfolioViewTab,
} from "@/components/portfolio/portfolio-page-tabs";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { netCashUsd, totalCostBasisInvested, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { cn } from "@/lib/utils";

const EMPTY_PORTFOLIO_TRANSACTIONS: PortfolioTransaction[] = [];

const PortfolioOverviewChart = dynamic(
  () =>
    import("@/components/portfolio/portfolio-overview-chart").then((m) => ({
      default: m.PortfolioOverviewChart as ComponentType<{
        transactions: PortfolioTransaction[];
        benchmarkInvestedUsd?: number | null;
      }>,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mb-6 w-full">
        <AssetChartSkeleton />
      </div>
    ),
  },
);

const PortfolioCashPanel = dynamic(
  () =>
    import("@/components/portfolio/portfolio-cash-panel").then((m) => ({
      default: m.PortfolioCashPanel,
    })),
  { loading: () => <PortfolioTabPanelSkeleton className="mb-6" /> },
);

const PortfolioTransactionsTable = dynamic(
  () =>
    import("@/components/portfolio/portfolio-transactions-table").then((m) => ({
      default: m.PortfolioTransactionsTable,
    })),
  { loading: () => <PortfolioTabPanelSkeleton className="mb-6" /> },
);

const PortfolioPerformancePanel = dynamic(
  () =>
    import("@/components/portfolio/portfolio-performance-panel").then((m) => ({
      default: m.PortfolioPerformancePanel,
    })),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="mb-10 w-full">
          <AssetChartSkeleton />
        </div>
        <div className="mb-10 w-full">
          <AssetChartSkeleton />
        </div>
        <PortfolioTabPanelSkeleton />
      </>
    ),
  },
);

const PortfolioMetricsPanel = dynamic(
  () =>
    import("@/components/portfolio/portfolio-metrics-panel").then((m) => ({
      default: m.PortfolioMetricsPanel as ComponentType<{
        holdings: PortfolioHolding[];
        transactions: PortfolioTransaction[];
      }>,
    })),
  { loading: () => <PortfolioTabPanelSkeleton className="mb-6" /> },
);

const PortfolioDividendsPanel = dynamic(
  () =>
    import("@/components/portfolio/portfolio-dividends-panel").then((m) => ({
      default: m.PortfolioDividendsPanel as ComponentType<{
        holdings: PortfolioHolding[];
        publicListingId?: string;
      }>,
    })),
  { loading: () => <PortfolioTabPanelSkeleton className="mb-6" /> },
);

function initialTabsVisited(active: PortfolioViewTab): Record<PortfolioViewTab, boolean> {
  return {
    Overview: active === "Overview",
    Performance: active === "Performance",
    Metrics: active === "Metrics",
    Dividends: active === "Dividends",
    Cash: active === "Cash",
    Transactions: active === "Transactions",
  };
}

const OVERVIEW_HOLDINGS_TAB_ITEMS = [
  { id: "assets" as const, label: "Assets" },
  { id: "allocation" as const, label: "Allocation" },
  { id: "slices" as const, label: "Slices" },
] as const;

export function PortfolioPageView({
  portfolioName,
  holdings,
  transactions,
  readOnly = false,
  showPortfoliosBreadcrumb = false,
  tabBasePath = "/portfolio",
  publicListingId,
}: {
  portfolioName: string;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  readOnly?: boolean;
  /** `Portfolios / {name}` for community read-only detail. */
  showPortfoliosBreadcrumb?: boolean;
  tabBasePath?: string;
  /** Community listing id — dividend schedule uses listing API. */
  publicListingId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = useCallback(
    (param: string | null) => {
      const tab = portfolioViewTabFromSearchParam(param);
      return readOnly && tab === "Cash" ? "Overview" : tab;
    },
    [readOnly],
  );

  const [viewTab, setViewTab] = useState<PortfolioViewTab>(() => tabFromUrl(searchParams.get("tab")));
  const [tabsVisited, setTabsVisited] = useState<Record<PortfolioViewTab, boolean>>(() =>
    initialTabsVisited(tabFromUrl(searchParams.get("tab"))),
  );
  const [overviewHoldingsSubTab, setOverviewHoldingsSubTab] = useState<OverviewHoldingsSubTab>(() =>
    overviewHoldingsSubTabFromSearchParam(searchParams.get("tab"), searchParams.get("view")),
  );
  const [importTransactionsOpen, setImportTransactionsOpen] = useState(false);

  const {
    selectedPortfolioId,
    openEditPortfolio,
    selectedPortfolioReadOnly,
    portfolioDisplayReady,
  } = usePortfolioWorkspace();

  const editDisabled = readOnly || selectedPortfolioReadOnly;

  useEffect(() => {
    setViewTab(tabFromUrl(searchParams.get("tab")));
    if (tabFromUrl(searchParams.get("tab")) === "Overview") {
      setOverviewHoldingsSubTab(
        overviewHoldingsSubTabFromSearchParam(searchParams.get("tab"), searchParams.get("view")),
      );
    }
  }, [searchParams, tabFromUrl]);

  useEffect(() => {
    if (searchParams.get("tab")?.toLowerCase() !== "slices") return;
    router.replace(`${tabBasePath}?tab=overview&view=slices`, { scroll: false });
  }, [searchParams, router, tabBasePath]);

  useEffect(() => {
    setTabsVisited((v) => ({ ...v, [viewTab]: true }));
  }, [viewTab]);

  const onTabChange = useCallback(
    (tab: PortfolioViewTab) => {
      if (readOnly && tab === "Cash") return;
      startTransition(() => {
        setViewTab(tab);
        const q = searchParamFromPortfolioViewTab(tab);
        if (tab === "Overview") {
          router.replace(
            `${tabBasePath}?tab=${q}&view=${searchParamFromOverviewHoldingsSubTab(overviewHoldingsSubTab)}`,
            { scroll: false },
          );
        } else {
          router.replace(`${tabBasePath}?tab=${q}`, { scroll: false });
        }
      });
    },
    [readOnly, router, tabBasePath, overviewHoldingsSubTab],
  );

  const onOverviewHoldingsSubTabChange = useCallback(
    (subTab: OverviewHoldingsSubTab) => {
      setOverviewHoldingsSubTab(subTab);
      router.replace(
        `${tabBasePath}?tab=overview&view=${searchParamFromOverviewHoldingsSubTab(subTab)}`,
        { scroll: false },
      );
    },
    [router, tabBasePath],
  );

  const overviewNetWorth = totalNetWorth(holdings, netCashUsd(transactions));
  const showOverviewHoldingsBlock = overviewNetWorth > 0;
  const benchmarkInvestedUsd = totalCostBasisInvested(holdings);

  const panelClass = (tab: PortfolioViewTab) =>
    cn(viewTab === tab ? "flex min-h-0 flex-1 flex-col" : "hidden");

  if (!portfolioDisplayReady) {
    return (
      <PortfolioPageLoadingShell
        publicView={readOnly}
        showPortfoliosBreadcrumb={showPortfoliosBreadcrumb}
      />
    );
  }

  return (
    <div className="relative flex min-h-full min-w-0 flex-col overflow-x-hidden bg-white px-4 py-4 sm:px-9 sm:py-6">
      {!readOnly ? (
        <ImportTransactionsModal open={importTransactionsOpen} onClose={() => setImportTransactionsOpen(false)} />
      ) : null}
      <AssetPageTopLoader />
      <div className="mb-6 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3 sm:flex-1 sm:items-center">
          <div className="flex min-w-0 flex-col gap-1">
            {showPortfoliosBreadcrumb ? (
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
                <Link
                  href="/portfolios"
                  className="shrink-0 text-[#71717A] transition-colors hover:text-[#09090B]"
                >
                  Portfolios
                </Link>
                <span className="shrink-0 text-[#71717A]" aria-hidden>
                  /
                </span>
                <span
                  className="min-w-0 truncate text-sm font-normal text-[#09090B]"
                  aria-current="page"
                >
                  {portfolioName}
                </span>
              </nav>
            ) : (
              <div className="flex min-w-0 max-w-full items-center gap-0">
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[#09090B]">
                  {portfolioName}
                </h1>
                <TransactionPortfolioField variant="titleGhost" compactMenuAlign="leading" />
              </div>
            )}
          </div>

          {!readOnly ? (
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 sm:hidden">
              <button
                type="button"
                aria-label="Import transactions"
                disabled={selectedPortfolioId == null || editDisabled}
                onClick={() => setImportTransactionsOpen(true)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
                  "hover:bg-[#F4F4F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Portfolio settings"
                disabled={selectedPortfolioId == null}
                onClick={() => {
                  if (selectedPortfolioId != null) openEditPortfolio(selectedPortfolioId);
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
                  "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
              <PortfolioQuickAddMenu aria-label="Portfolio quick add" />
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="hidden min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 sm:flex">
            <button
              type="button"
              aria-label="Import transactions"
              disabled={selectedPortfolioId == null || editDisabled}
              onClick={() => setImportTransactionsOpen(true)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
                "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Import Transactions</span>
            </button>
            <button
              type="button"
              aria-label="Portfolio settings"
              disabled={selectedPortfolioId == null}
              onClick={() => {
                if (selectedPortfolioId != null) openEditPortfolio(selectedPortfolioId);
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
                "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <PortfolioQuickAddMenu aria-label="Portfolio quick add" />
          </div>
        ) : null}
      </div>

      <PortfolioOverviewAthProvider>
        <PortfolioOverviewCards holdings={holdings} transactions={transactions} />

        <PortfolioPageTabs active={viewTab} onChange={onTabChange} publicView={readOnly} />

        <div className="flex min-h-0 flex-1 flex-col">
          {tabsVisited.Overview ? (
            <div
              className={panelClass("Overview")}
              role="tabpanel"
              id="portfolio-tab-overview"
              aria-hidden={viewTab !== "Overview"}
            >
              <PortfolioOverviewChart
                transactions={transactions}
                benchmarkInvestedUsd={benchmarkInvestedUsd}
              />
              <div className="pt-6">
                <SecondaryTabs
                  className="mb-4"
                  aria-label="Holdings view"
                  items={OVERVIEW_HOLDINGS_TAB_ITEMS}
                  value={overviewHoldingsSubTab}
                  onValueChange={onOverviewHoldingsSubTabChange}
                />
                {overviewHoldingsSubTab === "slices" ? (
                  <PortfolioSlicesView holdings={holdings} transactions={transactions} />
                ) : showOverviewHoldingsBlock ? (
                  overviewHoldingsSubTab === "assets" ? (
                    <PortfolioHoldingsTable
                      holdings={holdings}
                      transactions={transactions}
                      className="border-t-0"
                      assetLinkTab={readOnly ? "overview" : "holdings"}
                    />
                  ) : (
                    <PortfolioAllocationView holdings={holdings} transactions={transactions} />
                  )
                ) : (
                  <Empty variant="card" className="min-h-[min(50vh,400px)]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Layers2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>No holdings yet</EmptyTitle>
                      <EmptyDescription>
                        This public portfolio has no holdings in its published snapshot.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>
          ) : null}

          {tabsVisited.Performance ? (
            <div
              className={panelClass("Performance")}
              role="tabpanel"
              id="portfolio-tab-performance"
              aria-hidden={viewTab !== "Performance"}
            >
              <PortfolioPerformancePanel holdings={holdings} transactions={transactions} />
            </div>
          ) : null}

          {tabsVisited.Metrics ? (
            <div
              className={panelClass("Metrics")}
              role="tabpanel"
              id="portfolio-tab-metrics"
              aria-hidden={viewTab !== "Metrics"}
            >
              <PortfolioMetricsPanel holdings={holdings} transactions={transactions} />
            </div>
          ) : null}

          {tabsVisited.Dividends ? (
            <div
              className={panelClass("Dividends")}
              role="tabpanel"
              id="portfolio-tab-dividends"
              aria-hidden={viewTab !== "Dividends"}
            >
              <PortfolioDividendsPanel holdings={holdings} publicListingId={publicListingId} />
            </div>
          ) : null}

          {!readOnly && tabsVisited.Cash ? (
            <div
              className={panelClass("Cash")}
              role="tabpanel"
              id="portfolio-tab-cash"
              aria-hidden={viewTab !== "Cash"}
            >
              <PortfolioCashPanel />
            </div>
          ) : null}

          {tabsVisited.Transactions ? (
            <div
              className={panelClass("Transactions")}
              role="tabpanel"
              id="portfolio-tab-transactions"
              aria-hidden={viewTab !== "Transactions"}
            >
              <PortfolioTransactionsTable transactions={transactions} />
            </div>
          ) : null}
        </div>
      </PortfolioOverviewAthProvider>
    </div>
  );
}
