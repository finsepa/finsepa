"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CircleQuestionMark, Folder, Search, Star } from "lucide-react";
import { TOPBAR_SHOW_NOTIFICATIONS } from "@/lib/features/topbar-flags";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { netCashUsd, normalizeUsdForDisplay, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { TopbarDelayedTooltip } from "./topbar-delayed-tooltip";
import { OPEN_SEARCH_EVENT, SearchModal } from "./search-modal";
import { TopbarQuickAddMenu } from "./topbar-quick-add-menu";
import { TopbarUserMenu } from "./topbar-user-menu";
import {
  topbarSquircleIconClass,
  topbarSquircleTextButtonClass,
  topbarSquircleSplitShellClass,
} from "@/components/design-system/topbar-control-classes";
import { cn } from "@/lib/utils";

const usdTopbar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function IconButton({ children }: { children: React.ReactNode }) {
  return <button type="button" className={topbarSquircleIconClass}>{children}</button>;
}

const TopbarPortfolioBlock = memo(function TopbarPortfolioBlock() {
  const {
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
  } = usePortfolioWorkspace();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const ready = mounted && portfolioDisplayReady;
  const balanceLabel = ready ? `Portfolio, ${usdTopbar.format(displayTotal)}` : "Portfolio, loading";

  return (
    <TopbarDelayedTooltip label="My Portfolio" className="max-w-full min-w-0 shrink-0">
      {/* Mobile: hidden (portfolio lives in bottom nav + dedicated pages). */}
      <Link
        href="/portfolio"
        prefetch={false}
        aria-busy={!ready}
        aria-label={balanceLabel}
        className={cn(
          topbarSquircleTextButtonClass,
          "hidden shrink-0 transition-colors hover:bg-[#F4F4F5] md:hidden",
        )}
      >
        <Folder className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="whitespace-nowrap">My Portfolio</span>
      </Link>

      <div className={cn(topbarSquircleSplitShellClass, "hidden 2xl:flex")}>
        <Link
          href="/portfolio"
          prefetch={false}
          aria-busy={!ready}
          aria-label={balanceLabel}
          className="flex min-w-0 max-w-none items-center gap-2 border-r border-[#E4E4E7] px-3 text-sm font-medium tabular-nums transition-colors hover:bg-[#F4F4F5]"
        >
          <Folder className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
          {ready ? (
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
    </TopbarDelayedTooltip>
  );
});

export function Topbar({
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
}: {
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Passed into the user menu: trial countdown after avatar + Upgrade to Pro in the dropdown. */
  platformTrialDaysLeft?: number | null;
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
      <header className="flex min-h-[60px] min-w-0 flex-nowrap items-center justify-between gap-3 overflow-x-hidden overflow-y-hidden px-4 py-3 [-webkit-overflow-scrolling:touch]">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0 w-full max-w-full flex-1 md:max-w-[300px]">
            <TopbarDelayedTooltip label="Search" className="relative block w-full max-w-full">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search (shortcut S)"
                className="flex h-9 min-w-0 w-full cursor-pointer items-center justify-start gap-2 rounded-lg bg-[#F4F4F5] px-4 text-left transition-all duration-100 hover:bg-[#EBEBEB]"
              >
                <Search className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm leading-5 text-[#A1A1AA]">Search...</span>
                <kbd
                  className="pointer-events-none hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA] md:inline-flex"
                  aria-hidden
                >
                  S
                </kbd>
              </button>
            </TopbarDelayedTooltip>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <TopbarDelayedTooltip label="Notifications">
              <IconButton>
                <Bell className="h-5 w-5" />
              </IconButton>
            </TopbarDelayedTooltip>
          ) : null}

          <TopbarDelayedTooltip label="Watchlist">
            <Link
              href="/watchlist"
              prefetch={false}
              aria-label="Watchlist"
              className={topbarSquircleIconClass}
            >
              <Star className="h-5 w-5" aria-hidden />
            </Link>
          </TopbarDelayedTooltip>

          <TopbarQuickAddMenu dwellTooltipLabel="Add/Create" />

          <TopbarPortfolioBlock />

          <TopbarUserMenu
            userInitials={userInitials}
            avatarUrl={avatarUrl}
            userDisplayName={userDisplayName}
            platformTrialDaysLeft={platformTrialDaysLeft}
          />

          <TopbarDelayedTooltip label="Help" className="hidden md:inline-flex">
            <a
              href="mailto:hi@finsepa.com"
              className={cn(topbarSquircleIconClass, "inline-flex")}
              aria-label="Email hi@finsepa.com"
            >
              <CircleQuestionMark className="h-5 w-5 shrink-0" aria-hidden />
            </a>
          </TopbarDelayedTooltip>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
