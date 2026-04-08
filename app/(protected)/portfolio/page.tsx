"use client";

import dynamic from "next/dynamic";
import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import { PortfolioQuickAddMenu } from "@/components/layout/portfolio-quick-add-menu";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
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
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

const EMPTY_PORTFOLIO_TRANSACTIONS: PortfolioTransaction[] = [];

/** Lazy: pulls `lightweight-charts` in a separate chunk. */
const PortfolioOverviewChart = dynamic(
  () =>
    import("@/components/portfolio/portfolio-overview-chart").then((m) => ({
      default: m.PortfolioOverviewChart as ComponentType<{ transactions: PortfolioTransaction[] }>,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mb-6 h-[320px] w-full animate-pulse rounded-lg bg-[#F4F4F5]" aria-hidden />
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

function initialTabsVisited(active: PortfolioViewTab): Record<PortfolioViewTab, boolean> {
  return {
    Overview: active === "Overview",
    Cash: active === "Cash",
    Transactions: active === "Transactions",
  };
}

function PortfolioPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewTab, setViewTab] = useState<PortfolioViewTab>(() =>
    portfolioViewTabFromSearchParam(searchParams.get("tab")),
  );
  const [tabsVisited, setTabsVisited] = useState<Record<PortfolioViewTab, boolean>>(() =>
    initialTabsVisited(portfolioViewTabFromSearchParam(searchParams.get("tab"))),
  );

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

  const { portfolios, selectedPortfolioId, holdingsByPortfolioId, transactionsByPortfolioId } =
    usePortfolioWorkspace();
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const title = selected?.name ?? "My Portfolio";
  const holdings =
    selectedPortfolioId != null ? holdingsByPortfolioId[selectedPortfolioId] ?? [] : [];
  const transactions =
    selectedPortfolioId != null ?
      transactionsByPortfolioId[selectedPortfolioId] ?? EMPTY_PORTFOLIO_TRANSACTIONS
    : EMPTY_PORTFOLIO_TRANSACTIONS;

  const panelClass = (tab: PortfolioViewTab) =>
    cn(viewTab === tab ? "flex min-h-0 flex-1 flex-col" : "hidden");

  return (
    <div className="relative flex min-h-full flex-col bg-white px-9 py-6">
      <AssetPageTopLoader />
      <div className="mb-6 flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-[#09090B]">{title}</h1>
          <TransactionPortfolioField variant="compact" />
        </div>
        <PortfolioQuickAddMenu aria-label="Portfolio quick add" />
      </div>

      <PortfolioPageTabs active={viewTab} onChange={onTabChange} />

      <div className="flex min-h-0 flex-1 flex-col">
        {tabsVisited.Overview ? (
          <div
            className={panelClass("Overview")}
            role="tabpanel"
            id="portfolio-tab-overview"
            aria-hidden={viewTab !== "Overview"}
          >
            <PortfolioOverviewAthProvider>
              <PortfolioOverviewCards holdings={holdings} transactions={transactions} />
              <PortfolioOverviewChart transactions={transactions} />
              {holdings.length > 0 ? (
                <PortfolioHoldingsTable holdings={holdings} transactions={transactions} />
              ) : (
                <div className="flex min-h-[min(50vh,400px)] flex-col items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-16 text-center">
                  <p className="text-lg font-semibold text-[#09090B]">Nothing found</p>
                  <p className="mt-1 text-sm text-[#71717A]">Nothing added yet</p>
                </div>
              )}
            </PortfolioOverviewAthProvider>
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
