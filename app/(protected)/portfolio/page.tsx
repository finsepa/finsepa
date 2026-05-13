"use client";

import dynamic from "next/dynamic";
import { Suspense, startTransition, useCallback, useEffect, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Layers2, Settings } from "lucide-react";

import { SegmentedControl } from "@/components/design-system";
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
  type PortfolioViewTab,
  portfolioViewTabFromSearchParam,
  searchParamFromPortfolioViewTab,
} from "@/components/portfolio/portfolio-page-tabs";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioPrivacy, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { netCashUsd, totalCostBasisInvested, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { cn } from "@/lib/utils";

const EMPTY_PORTFOLIO_TRANSACTIONS: PortfolioTransaction[] = [];

/** Lazy: pulls `lightweight-charts` in a separate chunk. */
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
        <ChartSkeleton />
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
          <ChartSkeleton />
        </div>
        <div className="mb-10 w-full">
          <ChartSkeleton />
        </div>
        <PortfolioTabPanelSkeleton />
      </>
    ),
  },
);

const PortfolioMetricsPanel = dynamic(
  () =>
    import("@/components/portfolio/portfolio-metrics-panel").then((m) => ({
      default: m.PortfolioMetricsPanel,
    })),
  { loading: () => <PortfolioTabPanelSkeleton className="mb-6" /> },
);

function initialTabsVisited(active: PortfolioViewTab): Record<PortfolioViewTab, boolean> {
  return {
    Overview: active === "Overview",
    Performance: active === "Performance",
    Metrics: active === "Metrics",
    Cash: active === "Cash",
    Slices: active === "Slices",
    Transactions: active === "Transactions",
  };
}

type OverviewHoldingsSubTab = "assets" | "allocation";

const OVERVIEW_HOLDINGS_TAB_ITEMS = [
  { id: "assets" as const, label: "Assets" },
  { id: "allocation" as const, label: "Allocation" },
] as const;

function PortfolioPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewTab, setViewTab] = useState<PortfolioViewTab>(() =>
    portfolioViewTabFromSearchParam(searchParams.get("tab")),
  );
  const [tabsVisited, setTabsVisited] = useState<Record<PortfolioViewTab, boolean>>(() =>
    initialTabsVisited(portfolioViewTabFromSearchParam(searchParams.get("tab"))),
  );
  const [overviewHoldingsSubTab, setOverviewHoldingsSubTab] = useState<OverviewHoldingsSubTab>("assets");
  const [importTransactionsOpen, setImportTransactionsOpen] = useState(false);

  useEffect(() => {
    setViewTab(portfolioViewTabFromSearchParam(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    setTabsVisited((v) => ({ ...v, [viewTab]: true }));
  }, [viewTab]);

  const onTabChange = useCallback(
    (tab: PortfolioViewTab) => {
      startTransition(() => {
        setViewTab(tab);
        const q = searchParamFromPortfolioViewTab(tab);
        router.replace(`/portfolio?tab=${q}`, { scroll: false });
      });
    },
    [router],
  );

  const {
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    openEditPortfolio,
    selectedPortfolioReadOnly,
    updatePortfolioPrivacy,
  } = usePortfolioWorkspace();
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const title = selected?.name ?? "My Portfolio";
  const holdings =
    selectedPortfolioId != null ? holdingsByPortfolioId[selectedPortfolioId] ?? [] : [];
  const transactions =
    selectedPortfolioId != null ?
      transactionsByPortfolioId[selectedPortfolioId] ?? EMPTY_PORTFOLIO_TRANSACTIONS
    : EMPTY_PORTFOLIO_TRANSACTIONS;

  const overviewNetWorth = totalNetWorth(holdings, netCashUsd(transactions));
  const showOverviewHoldingsBlock = overviewNetWorth > 0;
  const benchmarkInvestedUsd = totalCostBasisInvested(holdings);
  const privacyControlDisabled = selectedPortfolioId == null;
  const portfolioPrivacy = selected?.privacy ?? "private";

  const panelClass = (tab: PortfolioViewTab) =>
    cn(viewTab === tab ? "flex min-h-0 flex-1 flex-col" : "hidden");

  return (
    <div className="relative flex min-h-full min-w-0 flex-col overflow-x-hidden bg-white px-4 py-4 sm:px-9 sm:py-6">
      <ImportTransactionsModal open={importTransactionsOpen} onClose={() => setImportTransactionsOpen(false)} />
      <AssetPageTopLoader />
      <div className="mb-6 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3 sm:flex-1 sm:items-center">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 max-w-full items-center gap-0">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[#09090B]">
                {title}
              </h1>
              <TransactionPortfolioField variant="titleGhost" compactMenuAlign="leading" />
            </div>
          </div>

          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 sm:hidden">
            <SegmentedControl<PortfolioPrivacy>
              aria-label="Portfolio visibility"
              size="sm"
              options={[
                { value: "private", label: "Private", disabled: privacyControlDisabled },
                { value: "public", label: "Public", disabled: privacyControlDisabled },
              ]}
              value={portfolioPrivacy}
              onChange={(next) => {
                if (selectedPortfolioId != null) updatePortfolioPrivacy(selectedPortfolioId, next);
              }}
            />
            <button
              type="button"
              aria-label="Import transactions"
              disabled={selectedPortfolioId == null || selectedPortfolioReadOnly}
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
        </div>

        <div className="hidden min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 sm:flex">
          <SegmentedControl<PortfolioPrivacy>
            aria-label="Portfolio visibility"
            size="sm"
            options={[
              { value: "private", label: "Private", disabled: privacyControlDisabled },
              { value: "public", label: "Public", disabled: privacyControlDisabled },
            ]}
            value={portfolioPrivacy}
            onChange={(next) => {
              if (selectedPortfolioId != null) updatePortfolioPrivacy(selectedPortfolioId, next);
            }}
          />
          <button
            type="button"
            aria-label="Import transactions"
            disabled={selectedPortfolioId == null || selectedPortfolioReadOnly}
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
      </div>

      <PortfolioOverviewAthProvider>
        <PortfolioOverviewCards holdings={holdings} transactions={transactions} />

        <PortfolioPageTabs active={viewTab} onChange={onTabChange} />

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
                  onValueChange={setOverviewHoldingsSubTab}
                />
                {showOverviewHoldingsBlock ? (
                  overviewHoldingsSubTab === "assets" ? (
                    <PortfolioHoldingsTable
                      holdings={holdings}
                      transactions={transactions}
                      className="border-t-0"
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
                        Record buys or import trades to list your positions, weights, and how capital is allocated
                        across assets.
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
            <PortfolioMetricsPanel />
          </div>
        ) : null}

        {tabsVisited.Cash ? (
          <div
            className={panelClass("Cash")}
            role="tabpanel"
            id="portfolio-tab-cash"
            aria-hidden={viewTab !== "Cash"}
          >
            <PortfolioCashPanel />
          </div>
        ) : null}

        {tabsVisited.Slices ? (
          <div
            className={panelClass("Slices")}
            role="tabpanel"
            id="portfolio-tab-slices"
            aria-hidden={viewTab !== "Slices"}
          >
            <PortfolioSlicesView holdings={holdings} transactions={transactions} />
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

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioPageLoadingShell />}>
      <PortfolioPageInner />
    </Suspense>
  );
}
