import type { User } from "@supabase/supabase-js";

import type { WatchlistCollectionsSnapshot } from "@/lib/watchlist/collections";
import { unionWatchlistTickers } from "@/lib/watchlist/collections";
import { hasGuestWatchlistPendingMerge } from "@/lib/watchlist/guest-merge";
import type { WatchlistServerSnapshot } from "@/lib/watchlist/types";
import { serverSnapshotHasNoTickers } from "@/lib/watchlist/snapshot";

/** One-time cleanup window for accounts that inherited stale browser watchlist data. */
export const NEW_ACCOUNT_WATCHLIST_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

const RESET_DONE_KEY_PREFIX = "finsepa.watchlist.new-account-reset.v1";

function resetDoneStorageKey(userId: string): string {
  return `${RESET_DONE_KEY_PREFIX}.${userId}`;
}

export function isNewAccountWatchlistResetDone(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(resetDoneStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markNewAccountWatchlistResetDone(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(resetDoneStorageKey(userId), "1");
  } catch {
    /* quota */
  }
}

export function isUserWithinWatchlistResetWindow(user: User | null | undefined): boolean {
  if (!user?.created_at) return false;
  const createdAt = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= NEW_ACCOUNT_WATCHLIST_RESET_WINDOW_MS;
}

type BootstrapOptions = {
  mergeGuest?: boolean;
};

export function shouldRunNewAccountWatchlistReset(
  user: User | null | undefined,
  userId: string,
  options: BootstrapOptions,
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot | null,
): boolean {
  if (!user || !userId) return false;
  if (options.mergeGuest) return false;
  if (isNewAccountWatchlistResetDone(userId)) return false;
  if (hasGuestWatchlistPendingMerge()) return false;
  if (!isUserWithinWatchlistResetWindow(user)) return false;

  const hasLocalTickers = unionWatchlistTickers(local).length > 0;
  const hasServerTickers = Boolean(server && !serverSnapshotHasNoTickers(server));
  return hasLocalTickers || hasServerTickers;
}
