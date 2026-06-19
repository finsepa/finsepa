"use client";

import { Plus } from "@/lib/icons";

import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";
import { cn } from "@/lib/utils";

export function AssetPageHeaderActions({
  watchlistStorageKey,
  watchlistLabel,
  transactionSymbol,
  transactionName,
  className,
}: {
  watchlistStorageKey: string;
  watchlistLabel: string;
  transactionSymbol: string;
  transactionName: string;
  className?: string;
}) {
  const { openNewTransactionWithPreset } = usePortfolioWorkspace();
  const sym = transactionSymbol.trim().toUpperCase();

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <div className="group shrink-0">
        <WatchlistStarButton variant="detail" storageKey={watchlistStorageKey} label={watchlistLabel} />
      </div>
      <button
        type="button"
        onClick={() =>
          openNewTransactionWithPreset({
            symbol: sym,
            name: transactionName.trim() || sym,
          })
        }
        className={cn(
          topbarSquircleIconClass,
          "md:inline-flex md:w-auto md:gap-1.5 md:border-0 md:bg-[#2563EB] md:px-3.5 md:text-[13px] md:font-semibold md:text-white md:shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] md:hover:bg-[#1D4ED8] md:focus-visible:outline-none md:focus-visible:ring-2 md:focus-visible:ring-[#2563EB]/30 md:focus-visible:ring-offset-2",
        )}
        aria-label="Add Trade"
      >
        <Plus className="h-5 w-5 shrink-0 md:h-4 md:w-4" strokeWidth={1.75} aria-hidden />
        <span className="hidden md:inline">Add Trade</span>
      </button>
    </div>
  );
}
