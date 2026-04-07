/**
 * Client-only watchlist snapshot for offline / API-fallback persistence.
 * When signed in, storage is scoped per user so accounts on the same browser do not share stars.
 */

const STORAGE_KEY_LEGACY = "finsepa.watchlist.v1";

export type WatchlistLocalSnapshot = {
  v: 1;
  tickers: string[];
  /** Removed locally; server merge must not re-add until DELETE succeeds. */
  pendingRemoval?: string[];
};

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY_LEGACY}.u.${userId}`;
  return `${STORAGE_KEY_LEGACY}.guest`;
}

/** Tickers on the list + removals in flight (do not let server merge resurrect). */
export function readWatchlistLocalFull(userId: string | null = null): {
  tickers: string[];
  pendingRemoval: string[];
} {
  if (typeof window === "undefined") return { tickers: [], pendingRemoval: [] };
  try {
    const key = storageKeyForUser(userId);
    let raw = localStorage.getItem(key);
    if (!raw && userId && userId.length > 0) {
      raw = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (raw) {
        const migrated = readWatchlistRaw(raw);
        writeWatchlistLocal(migrated.tickers, userId, migrated.pendingRemoval);
        localStorage.removeItem(STORAGE_KEY_LEGACY);
        return migrated;
      }
    }
    if (!raw) return { tickers: [], pendingRemoval: [] };
    return readWatchlistRaw(raw);
  } catch {
    return { tickers: [], pendingRemoval: [] };
  }
}

export function readWatchlistLocal(userId: string | null = null): string[] {
  return readWatchlistLocalFull(userId).tickers;
}

function readWatchlistRaw(raw: string): { tickers: string[]; pendingRemoval: string[] } {
  try {
    const parsed = JSON.parse(raw) as Partial<WatchlistLocalSnapshot>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.tickers)) {
      return { tickers: [], pendingRemoval: [] };
    }
    const list = parsed.tickers
      .map((t) => String(t).trim().toUpperCase())
      .filter((t) => t.length > 0);
    const tickers = [...new Set(list)];
    const pr = Array.isArray(parsed.pendingRemoval)
      ? [...new Set(parsed.pendingRemoval.map((t) => String(t).trim().toUpperCase()).filter((t) => t.length > 0))]
      : [];
    return { tickers, pendingRemoval: pr };
  } catch {
    return { tickers: [], pendingRemoval: [] };
  }
}

export function writeWatchlistLocal(
  tickers: string[],
  userId: string | null = null,
  pendingRemoval: string[] = [],
): void {
  if (typeof window === "undefined") return;
  try {
    const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter((t) => t.length > 0))].sort();
    const pr = [...new Set(pendingRemoval.map((t) => t.trim().toUpperCase()).filter((t) => t.length > 0))].sort();
    const payload: WatchlistLocalSnapshot = {
      v: 1,
      tickers: unique,
      ...(pr.length > 0 ? { pendingRemoval: pr } : {}),
    };
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(payload));
  } catch {
    /* quota, private mode, etc. */
  }
}
