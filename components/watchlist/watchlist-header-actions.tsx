"use client";

import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
import type { WatchlistCollection } from "@/lib/watchlist/collections";

type Props = {
  name: string;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  onCreate: (name: string) => void;
  onCreateSection?: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void | Promise<void>;
  onSwitch: (id: string) => void;
  storageHydrated?: boolean;
};

export function WatchlistHeaderActions({
  name,
  watchlists,
  activeWatchlistId,
  onCreate,
  onCreateSection,
  onRename,
  onDelete,
  onSwitch,
  storageHydrated = false,
}: Props) {
  const showTitle = storageHydrated;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showTitle ? (
        <h1 className="truncate text-[20px] font-semibold leading-7 text-[#0F0F0F]" suppressHydrationWarning>
          {name}
        </h1>
      ) : (
        <div className="h-7 w-32 max-w-[50%] animate-pulse rounded bg-[#E4E4E7]" aria-hidden />
      )}
      <WatchlistOptionsMenu
        name={showTitle ? name : ""}
        watchlists={watchlists}
        activeWatchlistId={activeWatchlistId}
        onCreate={onCreate}
        onCreateSection={onCreateSection}
        onRename={onRename}
        onDelete={onDelete}
        onSwitch={onSwitch}
        variant="page-icon"
        ready={storageHydrated}
      />
    </div>
  );
}
