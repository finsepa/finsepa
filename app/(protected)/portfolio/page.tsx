"use client";

import { Suspense } from "react";

import { PortfolioPageView } from "@/components/portfolio/portfolio-page-view";
import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const EMPTY_PORTFOLIO_TRANSACTIONS: PortfolioTransaction[] = [];

function PortfolioPageInner() {
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

  return (
    <PortfolioPageView
      portfolioName={title}
      holdings={holdings}
      transactions={transactions}
      tabBasePath="/portfolio"
    />
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioPageLoadingShell />}>
      <PortfolioPageInner />
    </Suspense>
  );
}
