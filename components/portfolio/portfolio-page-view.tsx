"use client";

import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil } from "@/lib/icons";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { ChartScreenshotDownloadModal } from "@/components/chart/chart-screenshot-download-modal";
import { PortfolioQuickAddMenu } from "@/components/layout/portfolio-quick-add-menu";
import { PortfolioAllocationView } from "@/components/portfolio/portfolio-allocation-view";
import { PortfolioEarningsTable } from "@/components/portfolio/portfolio-earnings-table";
import { PortfolioHoldingsEmptyState } from "@/components/portfolio/portfolio-holdings-empty-state";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
import { PortfolioSlicesView } from "@/components/portfolio/portfolio-slices-view";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";
import { PortfolioOverviewAthProvider } from "@/components/portfolio/portfolio-overview-ath-context";
import { PortfolioOverviewCards } from "@/components/portfolio/portfolio-overview-cards";
import { PortfolioOverviewMetrics } from "@/components/portfolio/portfolio-overview-metrics";
import {
  PortfolioPageLoadingShell,
  PortfolioTabPanelSkeleton,
} from "@/components/portfolio/portfolio-page-loading";
import {
  PortfolioPageTabs,
  PORTFOLIO_HOLDINGS_SUB_TAB_ITEMS,
  type OverviewHoldingsSubTab,
  type PortfolioViewTab,
  overviewHoldingsSubTabFromSearchParam,
  portfolioViewTabFromSearchParam,
  searchParamFromOverviewHoldingsSubTab,
  searchParamFromPortfolioViewTab,
} from "@/components/portfolio/portfolio-page-tabs";
import { PortfolioHoldingsSubTabMobileCard } from "@/components/portfolio/portfolio-holdings-sub-tab-mobile-card";
import { useAllocationCenterAvatar } from "@/components/portfolio/use-allocation-center-avatar";
import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { PortfolioSyncStatusIcon } from "@/components/portfolio/portfolio-sync-status-icon";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { PortfoliosBreadcrumbs } from "@/components/portfolios/portfolios-breadcrumbs";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { totalCostBasisInvested } from "@/lib/portfolio/overview-metrics";
import {
  ALLOCATION_RETURN_PERIOD_DEFAULT,
  type AllocationReturnPeriodId,
} from "@/lib/portfolio/allocation-return-period";
import { buildPortfolioAllocationRows } from "@/lib/portfolio/portfolio-allocation-rows";
import { tradeSymbolsFromHistory } from "@/lib/portfolio/realized-pnl-from-trades";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { imageSrcToDataUrl } from "@/lib/media/same-origin-remote-image";
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
      <div className="relative mb-6 h-[240px] w-full sm:h-[320px]">
        <AssetChartSkeleton fill />
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
    Dividends: active === "Dividends",
    Cash: active === "Cash",
    Transactions: active === "Transactions",
  };
}

const OVERVIEW_HOLDINGS_EMBEDDED_EMPTY_CLASS =
  "max-md:min-h-[min(40vh,320px)] max-md:rounded-none max-md:border-0 max-md:shadow-none";

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

  const {
    portfolios,
    selectedPortfolioId,
    openEditPortfolio,
    portfolioDisplayReady,
  } = usePortfolioWorkspace();

  const selectedPortfolio =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;

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
    if (searchParams.get("tab")?.toLowerCase() !== "metrics") return;
    router.replace(`${tabBasePath}?tab=overview`, { scroll: false });
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

  const hasPortfolioLedger =
    holdings.length > 0 || tradeSymbolsFromHistory(transactions).length > 0;
  const showOverviewHoldingsBlock = hasPortfolioLedger;
  const benchmarkInvestedUsd = totalCostBasisInvested(holdings);
  const allocationRows = useMemo(
    () => buildPortfolioAllocationRows(holdings, transactions),
    [holdings, transactions],
  );

  const assetCount = holdings.length;
  const holdingsSubTabItems = useMemo(
    () =>
      PORTFOLIO_HOLDINGS_SUB_TAB_ITEMS.map((item) =>
        item.id === "assets" ? { ...item, badge: assetCount } : item,
      ),
    [assetCount],
  );
  const { imageSrc: allocationAvatarImageSrc, initials: allocationAvatarInitials } =
    useAllocationCenterAvatar();
  const [allocationReturnPeriod, setAllocationReturnPeriod] = useState<AllocationReturnPeriodId>(
    ALLOCATION_RETURN_PERIOD_DEFAULT,
  );
  const [allocationReturnPct, setAllocationReturnPct] = useState<number | null>(null);
  const [allocationDownloadOpen, setAllocationDownloadOpen] = useState(false);
  const [allocationDownloadSnapshot, setAllocationDownloadSnapshot] =
    useState<ChartScreenshotSnapshot | null>(null);

  const handleAllocationReturnMeta = useCallback(
    (meta: { period: AllocationReturnPeriodId; returnPct: number | null }) => {
      setAllocationReturnPeriod(meta.period);
      setAllocationReturnPct(meta.returnPct);
    },
    [],
  );

  const showAllocationDownload =
    showOverviewHoldingsBlock && overviewHoldingsSubTab === "allocation" && allocationRows.length > 0;

  const handleOpenAllocationDownload = useCallback(async () => {
    if (allocationRows.length === 0) return;
    const avatarDataUrl = await imageSrcToDataUrl(allocationAvatarImageSrc);
    setAllocationDownloadSnapshot({
      variant: "portfolioAllocation",
      ticker: portfolioName,
      companyName: portfolioName,
      periodMode: "annual",
      timeRange: "all",
      chartType: "bars",
      selectedMetrics: [],
      fullPoints: [],
      portfolioAllocation: {
        portfolioName,
        portfolioLogoUrl: selectedPortfolio?.snaptrade?.brokerageLogoUrl ?? null,
        rows: allocationRows,
        avatarImageSrc: avatarDataUrl ?? allocationAvatarImageSrc,
        avatarInitials: allocationAvatarInitials,
        returnPct: allocationReturnPct,
        returnPeriod: allocationReturnPeriod,
      },
    });
    setAllocationDownloadOpen(true);
  }, [
    allocationRows,
    portfolioName,
    selectedPortfolio?.snaptrade?.brokerageLogoUrl,
    allocationAvatarImageSrc,
    allocationAvatarInitials,
    allocationReturnPct,
    allocationReturnPeriod,
  ]);

  const allocationDownloadButton = showAllocationDownload ? (
    <button
      type="button"
      onClick={() => void handleOpenAllocationDownload()}
      className={cn(topbarSquircleIconClass, "shrink-0")}
      aria-label="Download allocation"
    >
      <Download className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </button>
  ) : null;

  const panelClass = (tab: PortfolioViewTab) =>
    cn(viewTab === tab ? "flex min-h-0 flex-1 flex-col" : "hidden");

  const portfolioToolbarActions =
    readOnly ? null : (
      <>
        {selectedPortfolioId != null && selectedPortfolio?.snaptrade ? (
          <PortfolioSyncStatusIcon
            portfolioId={selectedPortfolioId}
            snaptrade={selectedPortfolio.snaptrade}
            variant="toolbar"
          />
        ) : null}
        <button
          type="button"
          aria-label="Edit portfolio"
          disabled={selectedPortfolioId == null}
          onClick={() => {
            if (selectedPortfolioId != null) openEditPortfolio(selectedPortfolioId);
          }}
          className={cn(
            topbarSquircleIconClass,
            "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <PortfolioQuickAddMenu aria-label="Portfolio quick add" />
      </>
    );

  if (!portfolioDisplayReady) {
    return (
      <PortfolioPageLoadingShell
        publicView={readOnly}
        showPortfoliosBreadcrumb={showPortfoliosBreadcrumb}
      />
    );
  }

  return (
    <div className="relative flex min-h-full min-w-0 flex-col md:overflow-x-hidden">
      {showPortfoliosBreadcrumb ? <PortfoliosBreadcrumbs currentLabel={portfolioName} /> : null}
      <div className="relative flex min-h-full min-w-0 flex-1 flex-col px-4 pb-4 pt-2 max-md:overflow-visible md:overflow-x-hidden sm:px-9 sm:py-6">
      <AssetPageTopLoader />
      <div className="mb-6 hidden shrink-0 flex-col gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0 flex-col gap-1">
            {showPortfoliosBreadcrumb ? (
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[#0F0F0F]">
                {portfolioName}
              </h1>
            ) : (
              <div className="flex min-w-0 max-w-full items-center gap-2">
                {selectedPortfolio ? <PortfolioListLogo portfolio={selectedPortfolio} /> : null}
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[#0F0F0F]">
                  {portfolioName}
                </h1>
                <TransactionPortfolioField variant="titleGhost" compactMenuAlign="leading" />
              </div>
            )}
          </div>
        </div>

        {!readOnly ? (
          <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2">
            {portfolioToolbarActions}
          </div>
        ) : null}
      </div>

      <PortfolioOverviewAthProvider>
        <ChartScreenshotDownloadModal
          open={allocationDownloadOpen}
          onClose={() => setAllocationDownloadOpen(false)}
          snapshot={allocationDownloadSnapshot}
        />
        <PortfolioOverviewCards
          holdings={holdings}
          transactions={transactions}
          mobileToolbarActions={portfolioToolbarActions}
        />

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
              <PortfolioOverviewMetrics holdings={holdings} transactions={transactions} />
              <div className="max-md:pt-0 pt-6">
                <div className="mb-4 hidden items-center justify-between gap-3 md:flex">
                  <SecondaryTabs
                    className="min-w-0 flex-1"
                    aria-label="Holdings view"
                    items={holdingsSubTabItems}
                    value={overviewHoldingsSubTab}
                    onValueChange={onOverviewHoldingsSubTabChange}
                  />
                  {allocationDownloadButton}
                </div>
                <PortfolioHoldingsSubTabMobileCard
                  active={overviewHoldingsSubTab}
                  onChange={onOverviewHoldingsSubTabChange}
                  trailing={allocationDownloadButton}
                  assetCount={assetCount}
                >
                  {!showOverviewHoldingsBlock ? (
                    <PortfolioHoldingsEmptyState
                      readOnly={readOnly}
                      className={OVERVIEW_HOLDINGS_EMBEDDED_EMPTY_CLASS}
                    />
                  ) : overviewHoldingsSubTab === "slices" ? (
                    <div className="max-md:p-4 md:contents">
                      <PortfolioSlicesView holdings={holdings} transactions={transactions} readOnly={readOnly} />
                    </div>
                  ) : overviewHoldingsSubTab === "earnings" ? (
                    <PortfolioEarningsTable
                      holdings={holdings}
                      className="sm:border-t-0"
                      assetLinkTab={readOnly ? "overview" : "holdings"}
                    />
                  ) : overviewHoldingsSubTab === "assets" ? (
                    <PortfolioHoldingsTable
                      holdings={holdings}
                      transactions={transactions}
                      className="sm:border-t-0"
                      assetLinkTab={readOnly ? "overview" : "holdings"}
                    />
                  ) : (
                    <PortfolioAllocationView
                      holdings={holdings}
                      transactions={transactions}
                      readOnly={readOnly}
                      period={allocationReturnPeriod}
                      onPeriodChange={setAllocationReturnPeriod}
                      onReturnMetaChange={handleAllocationReturnMeta}
                    />
                  )}
                </PortfolioHoldingsSubTabMobileCard>
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
    </div>
  );
}
