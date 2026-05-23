"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Briefcase, CircleQuestionMark, Star } from "lucide-react";
import { TOPBAR_SHOW_NOTIFICATIONS } from "@/lib/features/topbar-flags";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { netCashUsd, normalizeUsdForDisplay, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { TopbarDelayedTooltip } from "./topbar-delayed-tooltip";
import { TopbarSearch } from "./topbar-search";
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
          // Legacy compact label button; keep hidden so tablets use the full amount + dropdown control.
          "hidden",
        )}
      >
        <Briefcase className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="whitespace-nowrap">My Portfolio</span>
      </Link>

      <div className={cn(topbarSquircleSplitShellClass, "hidden sm:flex")}>
        <Link
          href="/portfolio"
          prefetch={false}
          aria-busy={!ready}
          aria-label={balanceLabel}
          className="flex min-w-0 max-w-none items-center gap-2 border-r border-[#E4E4E7] px-3 text-sm font-medium tabular-nums transition-colors hover:bg-[#F4F4F5]"
        >
          <Briefcase className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
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
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
}: {
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Passed into the user menu: trial countdown after avatar + Upgrade to Pro in the dropdown. */
  platformTrialDaysLeft?: number | null;
}) {
  return (
    <>
      <header className="flex h-14 min-w-0 flex-nowrap items-center gap-2 overflow-hidden max-md:px-4 md:min-h-[60px] md:h-auto md:gap-3 md:px-4 md:py-3">
        <div className="flex h-9 min-w-0 flex-1 items-center">
          <div className="min-w-0 w-full md:max-w-[360px]">
            <TopbarSearch />
          </div>
        </div>

        <div className="flex h-9 shrink-0 items-center gap-2 md:gap-3">
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <TopbarDelayedTooltip label="Notifications">
              <IconButton>
                <Bell className="h-5 w-5" />
              </IconButton>
            </TopbarDelayedTooltip>
          ) : null}

          <TopbarDelayedTooltip label="Watchlist" className="inline-flex shrink-0 md:hidden">
            <Link
              href="/watchlist"
              prefetch={false}
              aria-label="Watchlist"
              className={cn(topbarSquircleIconClass, "inline-flex")}
            >
              <Star className="h-5 w-5" aria-hidden />
            </Link>
          </TopbarDelayedTooltip>

          <TopbarQuickAddMenu
            showDesktopLabel
            desktopLabel="Add/Create"
            dwellTooltipLabel="Add/Create"
          />

          <div className="hidden sm:flex sm:shrink-0">
            <TopbarPortfolioBlock />
          </div>

          <TopbarUserMenu
            userId={userId}
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
    </>
  );
}
