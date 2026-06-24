export const DEFAULT_WATCHLIST_DISPLAY_NAME = "Watchlist";

const STORAGE_KEY = "finsepa.watchlist.display-name.v1";

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY}.u.${userId}`;
  return `${STORAGE_KEY}.guest`;
}

export function readWatchlistDisplayName(userId: string | null = null): string {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST_DISPLAY_NAME;
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId))?.trim();
    return raw && raw.length > 0 ? raw : DEFAULT_WATCHLIST_DISPLAY_NAME;
  } catch {
    return DEFAULT_WATCHLIST_DISPLAY_NAME;
  }
}

export function writeWatchlistDisplayName(userId: string | null, name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(storageKeyForUser(userId), trimmed);
  } catch {
    /* quota, private mode */
  }
}
