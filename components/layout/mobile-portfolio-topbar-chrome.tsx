"use client";

import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";

export function isPortfolioWorkspaceRoute(pathname: string): boolean {
  return pathname === "/portfolio" || pathname.startsWith("/portfolio/");
}

/** Mobile top bar: portfolio name and switcher (replaces section title on `/portfolio`). */
export function MobilePortfolioTopbarChrome() {
  const { portfolios, selectedPortfolioId, portfolioDisplayReady } = usePortfolioWorkspace();
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const name = selected?.name ?? "My Portfolio";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1
        suppressHydrationWarning
        className="min-w-0 truncate text-[22px] font-semibold leading-7 tracking-[-0.02em] text-[#09090B]"
      >
        {portfolioDisplayReady ? (
          name
        ) : (
          <span className="inline-block h-7 w-[min(100%,10rem)] max-w-full animate-pulse rounded-md bg-[#E4E4E7]" />
        )}
      </h1>
      {portfolioDisplayReady ? (
        <TransactionPortfolioField variant="titleGhost" compactMenuAlign="leading" />
      ) : null}
    </div>
  );
}
