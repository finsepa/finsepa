"use client";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
import { FREE_MAX_WATCHLIST_ASSETS } from "@/lib/account/plan-entitlements";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

export function isWatchlistRoute(pathname: string): boolean {
  return pathname === "/watchlist" || pathname.startsWith("/watchlist/");
}

/** Mobile top bar: watchlist name and switcher (replaces section title on `/watchlist`). */
export function MobileWatchlistTopbarChrome() {
  const {
    activeWatchlistName,
    watchlists,
    activeWatchlistId,
    watchedTickers,
    createWatchlist,
    createActiveSection,
    renameActiveWatchlist,
    deleteActiveWatchlist,
    switchWatchlist,
    storageHydrated,
  } = useWatchlist();
  const plan = usePlanAccessOptional();
  const countBadge =
    plan?.isFree === true
      ? `${watchedTickers.length}/${plan.maxWatchlistAssets ?? FREE_MAX_WATCHLIST_ASSETS}`
      : null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1
        suppressHydrationWarning
        className="inline-flex min-w-0 items-center gap-1.5 truncate text-[22px] font-semibold leading-7 tracking-[-0.02em] text-fg"
      >
        {storageHydrated ? (
          <>
            <span className="truncate">{activeWatchlistName}</span>
            {countBadge ? (
              <span className="inline-flex h-[18px] shrink-0 items-center justify-center rounded-full bg-stroke px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg">
                {countBadge}
              </span>
            ) : null}
          </>
        ) : (
          <span className="inline-block h-7 w-[min(100%,10rem)] max-w-full animate-pulse rounded-md bg-stroke" />
        )}
      </h1>
      <WatchlistOptionsMenu
        name={storageHydrated ? activeWatchlistName : ""}
        watchlists={watchlists}
        activeWatchlistId={activeWatchlistId}
        onCreate={createWatchlist}
        onCreateSection={createActiveSection}
        onRename={renameActiveWatchlist}
        onDelete={deleteActiveWatchlist}
        onSwitch={switchWatchlist}
        variant="page-icon"
        ready={storageHydrated}
      />
    </div>
  );
}
