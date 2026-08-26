"use client";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
import type { WatchlistCollection } from "@/lib/watchlist/collections";
import { FREE_MAX_WATCHLIST_ASSETS } from "@/lib/account/plan-entitlements";

type Props = {
  name: string;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  /** Active list ticker count (for Free `n/15` badge). */
  assetCount?: number;
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
  assetCount = 0,
  onCreate,
  onCreateSection,
  onRename,
  onDelete,
  onSwitch,
  storageHydrated = false,
}: Props) {
  const plan = usePlanAccessOptional();
  const showTitle = storageHydrated;
  const countBadge =
    plan?.isFree === true
      ? `${assetCount}/${plan.maxWatchlistAssets ?? FREE_MAX_WATCHLIST_ASSETS}`
      : null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showTitle ? (
        <h1 className="inline-flex min-w-0 items-center gap-1.5 truncate text-[20px] font-semibold leading-7 text-fg">
          <span className="truncate" suppressHydrationWarning>
            {name}
          </span>
          {countBadge ? (
            <span
              suppressHydrationWarning
              className="inline-flex h-[18px] shrink-0 items-center justify-center rounded-full bg-stroke px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg"
            >
              {countBadge}
            </span>
          ) : null}
        </h1>
      ) : (
        <div className="h-7 w-32 max-w-[50%] animate-pulse rounded bg-stroke" aria-hidden />
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
