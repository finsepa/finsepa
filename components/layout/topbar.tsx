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

  return (
    <div className="flex h-9 max-w-full min-w-0 shrink-0 items-stretch overflow-visible rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <Link
        href="/portfolio"
        aria-busy={!portfolioDisplayReady}
        aria-label={portfolioDisplayReady ? undefined : "Loading portfolio balance"}
        className="flex min-w-0 max-w-[200px] items-center gap-2 border-r border-[#E4E4E7] px-3 text-sm font-medium tabular-nums transition-colors hover:bg-[#F4F4F5] sm:max-w-none"
      >
        <Folder className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
        {portfolioDisplayReady ? (
          <span className={`min-w-0 truncate ${amountClass}`}>{usdTopbar.format(displayTotal)}</span>
        ) : (
          <span
            className="inline-block h-[18px] min-w-[4.75rem] shrink-0 animate-pulse rounded-md bg-[#E4E4E7]"
            aria-hidden
          />
        )}
      </Link>
      <TransactionPortfolioField variant="compact" compactMenuAlign="trailing" />
    </div>
  );
});

const topbarSquircleIconClass =
  "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]";

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
      <header className="flex h-[60px] min-w-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search (shortcut S)"
            className="flex h-9 w-full min-w-0 max-w-[300px] cursor-pointer items-center gap-2 rounded-lg bg-[#F4F4F5] px-4 text-left transition-all duration-100 hover:bg-[#EBEBEB]"
          >
            <Search className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm leading-5 text-[#A1A1AA]">Search...</span>
            <kbd
              className="pointer-events-none shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA]"
              aria-hidden
            >
              S
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <IconButton>
              <Bell className="h-5 w-5" />
            </IconButton>
          ) : null}

          <Link href="/watchlist">
            <IconButton>
              <Star className="h-5 w-5" />
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
            className={topbarSquircleIconClass}
            aria-label="Email hi@finsepa.com"
          >
            <CircleQuestionMark className="h-5 w-5 shrink-0" aria-hidden />
          </a>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
