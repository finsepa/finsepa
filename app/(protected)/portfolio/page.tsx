"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PortfolioQuickAddMenu } from "@/components/layout/portfolio-quick-add-menu";
import { PortfolioCashPanel } from "@/components/portfolio/portfolio-cash-panel";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
import { PortfolioOverviewCards } from "@/components/portfolio/portfolio-overview-cards";
import {
  PortfolioPageTabs,
  type PortfolioViewTab,
  portfolioViewTabFromSearchParam,
  searchParamFromPortfolioViewTab,
} from "@/components/portfolio/portfolio-page-tabs";
import { PortfolioTransactionsTable } from "@/components/portfolio/portfolio-transactions-table";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";

function PortfolioPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewTab, setViewTab] = useState<PortfolioViewTab>(() =>
    portfolioViewTabFromSearchParam(searchParams.get("tab")),
  );

  useEffect(() => {
    setViewTab(portfolioViewTabFromSearchParam(searchParams.get("tab")));
  }, [searchParams]);

  const onTabChange = useCallback(
    (tab: PortfolioViewTab) => {
      setViewTab(tab);
      const q = searchParamFromPortfolioViewTab(tab);
      router.replace(`/portfolio?tab=${q}`, { scroll: false });
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
    selectedPortfolioId != null ? transactionsByPortfolioId[selectedPortfolioId] ?? [] : [];

  return (
    <div className="flex min-h-full flex-col bg-white px-9 py-6">
      {/* Match Screener page shell: single px-9 py-6; mb-6 mirrors UnderlineTabs mb-6 between major sections */}
      <div className="mb-6 flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-[#09090B]">{title}</h1>
          <TransactionPortfolioField variant="compact" />
        </div>
        <PortfolioQuickAddMenu aria-label="Portfolio quick add" />
      </div>

      <PortfolioPageTabs active={viewTab} onChange={onTabChange} />

      <div className="flex min-h-0 flex-1 flex-col">
        {viewTab === "Overview" ? (
          <>
            <PortfolioOverviewCards holdings={holdings} transactions={transactions} />
            {holdings.length > 0 ? (
              <PortfolioHoldingsTable holdings={holdings} />
            ) : (
              <div className="flex min-h-[min(50vh,400px)] flex-col items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-16 text-center">
                <p className="text-lg font-semibold text-[#09090B]">Nothing found</p>
                <p className="mt-1 text-sm text-[#71717A]">Nothing added yet</p>
              </div>
            )}
          </>
        ) : viewTab === "Cash" ? (
          <PortfolioCashPanel />
        ) : (
          <PortfolioTransactionsTable transactions={transactions} />
        )}
      </div>
    </div>
  );
}

function PortfolioPageFallback() {
  return <div className="min-h-[40vh] bg-white px-9 py-6" aria-hidden />;
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioPageFallback />}>
      <PortfolioPageInner />
    </Suspense>
  );
}
