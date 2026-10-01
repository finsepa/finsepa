"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { PortfolioPageView } from "@/components/portfolio/portfolio-page-view";
import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const EMPTY_PORTFOLIO_TRANSACTIONS: PortfolioTransaction[] = [];

function HomeAccountOverviewInner() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = typeof params.portfolioId === "string" ? params.portfolioId : "";
  const {
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
  } = usePortfolioWorkspace();

  /** The URL owns the selection here; the workspace setter navigates when something else picks a portfolio. */
  useEffect(() => {
    if (!portfolioDisplayReady || !portfolioId) return;
    if (!portfolios.some((p) => p.id === portfolioId)) {
      router.replace("/home");
      return;
    }
    if (selectedPortfolioId === portfolioId) return;
    if (!isFreePortfolioAccessible(portfolioId)) {
      // Setter shows the Pro / Free-pick prompt and keeps the current selection.
      setSelectedPortfolioId(portfolioId);
      router.replace(selectedPortfolioId ? `/home/${selectedPortfolioId}` : "/home");
      return;
    }
    setSelectedPortfolioId(portfolioId);
  }, [
    portfolioDisplayReady,
    portfolioId,
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
    router,
  ]);

  const selected = portfolios.find((p) => p.id === portfolioId) ?? null;
  const title = selected?.name ?? "Account";
  const holdings = portfolioId ? holdingsByPortfolioId[portfolioId] ?? [] : [];
  const transactions = portfolioId
    ? transactionsByPortfolioId[portfolioId] ?? EMPTY_PORTFOLIO_TRANSACTIONS
    : EMPTY_PORTFOLIO_TRANSACTIONS;

  if (!portfolioDisplayReady || !selected || selectedPortfolioId !== portfolioId) {
    return <PortfolioPageLoadingShell showPortfoliosBreadcrumb />;
  }

  return (
    <PortfolioPageView
      portfolioName={title}
      holdings={holdings}
      transactions={transactions}
      tabBasePath={`/home/${portfolioId}`}
      showAccountsBreadcrumb
    />
  );
}

/** Nested account overview under Portfolio home — breadcrumbs → full portfolio workspace. */
export default function HomeAccountOverviewPage() {
  return (
    <Suspense fallback={<PortfolioPageLoadingShell showPortfoliosBreadcrumb />}>
      <HomeAccountOverviewInner />
    </Suspense>
  );
}
