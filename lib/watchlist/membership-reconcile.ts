import {
  addTickerToSnapshot,
  removeTickerFromAllInSnapshot,
  type WatchlistCollectionsSnapshot,
} from "@/lib/watchlist/collections";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";
import type { WatchlistServerSnapshot } from "@/lib/watchlist/types";
import { serverSnapshotContainsTicker } from "@/lib/watchlist/snapshot";

export type MembershipReconcileJob = {
  generation: number;
  ticker: string;
  storageKey: string;
  /** True after add; false after remove. */
  expectedOnServer: boolean;
  previous: WatchlistCollectionsSnapshot;
  kind: "add" | "remove";
};

function tickerInList(tickers: string[], storageKey: string): boolean {
  const key = normalizeWatchlistStorageKey(storageKey);
  return tickers.some((entry) => normalizeWatchlistStorageKey(entry) === key);
}

/** Undo a failed add — drop the ticker everywhere without touching other layout. */
export function rollbackFailedAddMembership(
  snapshot: WatchlistCollectionsSnapshot,
  storageKey: string,
): WatchlistCollectionsSnapshot {
  return removeTickerFromAllInSnapshot(snapshot, storageKey);
}

/** Undo a failed remove — restore ticker only on lists that had it before. */
export function rollbackFailedRemoveMembership(
  current: WatchlistCollectionsSnapshot,
  previous: WatchlistCollectionsSnapshot,
  storageKey: string,
): WatchlistCollectionsSnapshot {
  let next = current;
  for (const prevList of previous.lists) {
    if (!tickerInList(prevList.tickers, storageKey)) continue;
    const curList = next.lists.find((list) => list.id === prevList.id);
    if (!curList || tickerInList(curList.tickers, storageKey)) continue;
    const added = addTickerToSnapshot(next, prevList.id, storageKey);
    if (added) next = added;
  }
  return next;
}

export function membershipReconcileConfirmed(
  server: WatchlistServerSnapshot,
  job: MembershipReconcileJob,
): boolean {
  const onServer = serverSnapshotContainsTicker(server, job.ticker);
  return onServer === job.expectedOnServer;
}

export function applyMembershipReconcileRollback(
  current: WatchlistCollectionsSnapshot,
  job: MembershipReconcileJob,
): WatchlistCollectionsSnapshot {
  if (job.expectedOnServer) {
    return rollbackFailedAddMembership(current, job.storageKey);
  }
  return rollbackFailedRemoveMembership(current, job.previous, job.storageKey);
}
