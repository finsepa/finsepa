"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";

/** Legacy My Portfolio URL — forwards to the selected portfolio under Home, keeping `?tab=` deep links. */
function PortfolioRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { portfolios, selectedPortfolioId, portfolioDisplayReady } = usePortfolioWorkspace();

  useEffect(() => {
    if (!portfolioDisplayReady) return;
    const target = portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
    const query = searchParams.toString();
    router.replace(target ? `/home/${target.id}${query ? `?${query}` : ""}` : "/home");
  }, [portfolioDisplayReady, portfolios, selectedPortfolioId, searchParams, router]);

  return <PortfolioPageLoadingShell />;
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioPageLoadingShell />}>
      <PortfolioRedirectInner />
    </Suspense>
  );
}
