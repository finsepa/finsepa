const GUEST_WATCHLIST_PENDING_MERGE_KEY = "finsepa.watchlist.guest-merge-pending";

/** Guest starred or edited a watchlist this browser session — allow one merge on sign-in. */
export function markGuestWatchlistPendingMerge(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(GUEST_WATCHLIST_PENDING_MERGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function consumeGuestWatchlistPendingMerge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = sessionStorage.getItem(GUEST_WATCHLIST_PENDING_MERGE_KEY) === "1";
    sessionStorage.removeItem(GUEST_WATCHLIST_PENDING_MERGE_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function hasGuestWatchlistPendingMerge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_WATCHLIST_PENDING_MERGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearGuestWatchlistPendingMerge(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GUEST_WATCHLIST_PENDING_MERGE_KEY);
  } catch {
    /* private mode */
  }
}
