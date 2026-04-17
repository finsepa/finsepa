"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CircleQuestionMark, Folder, Search, Star } from "lucide-react";
import { TOPBAR_SHOW_NOTIFICATIONS } from "@/lib/features/topbar-flags";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { netCashUsd, normalizeUsdForDisplay, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { OPEN_SEARCH_EVENT, SearchModal } from "./search-modal";
import { TopbarQuickAddMenu } from "./topbar-quick-add-menu";
import { TopbarUserMenu } from "./topbar-user-menu";

const usdTopbar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TopbarPortfolioBlock = memo(function TopbarPortfolioBlock() {
  const {
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
  } = usePortfolioWorkspace();

  /** Same as Portfolio → Overview “Value”: equity market value + net cash. */
  const total = useMemo(() => {
    if (selectedPortfolioId == null) return 0;
    const holdings = holdingsByPortfolioId[selectedPortfolioId] ?? [];
    const transactions = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    const cash = netCashUsd(transactions);
    return totalNetWorth(holdings, cash);
  }, [selectedPortfolioId, holdingsByPortfolioId, transactionsByPortfolioId]);

  const displayTotal = normalizeUsdForDisplay(total);
  const amountClass = displayTotal < 0 ? "text-red-600" : "text-[#09090B]";

  const balanceLabel = portfolioDisplayReady ? `Portfolio, ${usdTopbar.format(displayTotal)}` : "Portfolio, loading";

  return (
    <div className="flex h-8 max-w-full min-w-0 shrink-0 items-stretch overflow-visible rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] sm:h-9">
      <Link
        href="/portfolio"
        aria-busy={!portfolioDisplayReady}
        aria-label={balanceLabel}
        title={portfolioDisplayReady ? usdTopbar.format(displayTotal) : undefined}
        className="flex min-w-0 max-w-[200px] items-center gap-2 border-r border-[#E4E4E7] px-2 text-sm font-medium tabular-nums transition-colors hover:bg-[#F4F4F5] sm:max-w-none sm:px-3"
      >
        <Folder className="h-4 w-4 shrink-0 text-[#09090B] sm:h-5 sm:w-5" aria-hidden />
        {portfolioDisplayReady ? (
          <span className={`hidden min-w-0 truncate sm:inline ${amountClass}`}>{usdTopbar.format(displayTotal)}</span>
        ) : (
          <span
            className="hidden h-[18px] min-w-[4.75rem] shrink-0 animate-pulse rounded-md bg-[#E4E4E7] sm:inline-block"
            aria-hidden
          />
        )}
      </Link>
      <TransactionPortfolioField variant="compact" compactMenuAlign="trailing" />
    </div>
  );
});

const topbarSquircleIconClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] sm:h-9 sm:w-9";

function IconButton({ children }: { children: React.ReactNode }) {
  return <button type="button" className={topbarSquircleIconClass}>{children}</button>;
}

export function Topbar({
  userInitials,
  avatarUrl,
  userDisplayName,
}: {
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true], [role=textbox]")) return;
      e.preventDefault();
      setSearchOpen(true);
    }
    function onOpenSearch() {
      setSearchOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    };
  }, []);

  return (
    <>
      <header className="flex min-h-[52px] min-w-0 items-center justify-between gap-1.5 px-2 py-2 sm:min-h-[60px] sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center sm:gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search (shortcut S)"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#F4F4F5] transition-all duration-100 hover:bg-[#EBEBEB] sm:h-9 sm:w-full sm:min-w-0 sm:max-w-[300px] sm:justify-start sm:gap-2 sm:px-4 sm:text-left"
          >
            <Search className="h-4 w-4 shrink-0 text-[#09090B] sm:h-5 sm:w-5" aria-hidden />
            <span className="hidden min-w-0 flex-1 truncate text-sm leading-5 text-[#A1A1AA] sm:inline">Search...</span>
            <kbd
              className="pointer-events-none hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA] sm:inline-block"
              aria-hidden
            >
              S
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <IconButton>
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconButton>
          ) : null}

          <Link href="/watchlist">
            <IconButton>
              <Star className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconButton>
          </Link>

          <TopbarQuickAddMenu />

          <TopbarPortfolioBlock />

          <TopbarUserMenu
            userInitials={userInitials}
            avatarUrl={avatarUrl}
            userDisplayName={userDisplayName}
          />

          <a
            href="mailto:hi@finsepa.com"
            className={`${topbarSquircleIconClass} hidden sm:flex`}
            aria-label="Email hi@finsepa.com"
          >
            <CircleQuestionMark className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
          </a>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
