"use client";

import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
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
    createWatchlist,
    createActiveSection,
    renameActiveWatchlist,
    deleteActiveWatchlist,
    switchWatchlist,
    storageHydrated,
  } = useWatchlist();

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1
        suppressHydrationWarning
        className="min-w-0 truncate text-[22px] font-semibold leading-7 tracking-[-0.02em] text-[#0F0F0F]"
      >
        {storageHydrated ? (
          activeWatchlistName
        ) : (
          <span className="inline-block h-7 w-[min(100%,10rem)] max-w-full animate-pulse rounded-md bg-[#E4E4E7]" />
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
