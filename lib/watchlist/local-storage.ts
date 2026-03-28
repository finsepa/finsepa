/**
 * Client-only watchlist snapshot for offline / pre-auth / API-fallback persistence.
 * Extend by bumping `v` and migrating in `readWatchlistLocal`.
 */

const STORAGE_KEY = "finsepa.watchlist.v1";

export type WatchlistLocalSnapshot = {
  v: 1;
  tickers: string[];
};

export function readWatchlistLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WatchlistLocalSnapshot>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.tickers)) return [];
    const list = parsed.tickers
      .map((t) => String(t).trim().toUpperCase())
      .filter((t) => t.length > 0);
    return [...new Set(list)];
  } catch {
    return [];
  }
}

export function writeWatchlistLocal(tickers: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter((t) => t.length > 0))].sort();
    const payload: WatchlistLocalSnapshot = { v: 1, tickers: unique };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota, private mode, etc. */
  }
}
