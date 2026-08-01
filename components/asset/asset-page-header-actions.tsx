"use client";

import { Plus } from "@/lib/icons";

import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
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

  // Stable class string (no `cn`/`twMerge`) — avoids chrome hydration mismatch.
  const addTradeButtonClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-fg text-page shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-opacity duration-100 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 focus-visible:ring-offset-2 focus-visible:ring-offset-panel md:w-auto md:px-3 md:text-[13px] md:font-semibold";

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <div className="group shrink-0">
        <WatchlistStarButton variant="detail" storageKey={watchlistStorageKey} label={watchlistLabel} />
      </div>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() =>
          openNewTransactionWithPreset({
            symbol: sym,
            name: transactionName.trim() || sym,
          })
        }
        className={addTradeButtonClass}
        aria-label="Add Trade"
      >
        <Plus className="h-5 w-5 shrink-0 md:h-4 md:w-4" strokeWidth={1.75} aria-hidden />
        <span className="hidden md:inline">Add Trade</span>
      </button>
    </div>
  );
}
