"use client";

import { DEFAULT_WATCHLIST_DISPLAY_NAME } from "@/lib/watchlist/display-name";
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
  const displayName = storageHydrated ? name : DEFAULT_WATCHLIST_DISPLAY_NAME;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-[20px] font-semibold leading-7 text-[#09090B]" suppressHydrationWarning>
        {displayName}
      </h1>
      <WatchlistOptionsMenu
        name={displayName}
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
