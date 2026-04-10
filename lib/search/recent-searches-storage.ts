import type { SearchAssetItem } from "@/lib/search/search-types";

const STORAGE_KEY = "finsepa-search-recent-v1";
/** Most recent first; oldest dropped when a new navigation is recorded past this cap. */
export const MAX_RECENT_SEARCHES = 10;

function safeParse(raw: string | null): SearchAssetItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(isSearchAssetItem);
  } catch {
    return [];
  }
}

function isSearchAssetItem(x: unknown): x is SearchAssetItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "stock" || o.type === "crypto" || o.type === "index") &&
    typeof o.symbol === "string" &&
    typeof o.name === "string" &&
    typeof o.route === "string"
  );
}

/** Keeps first occurrence of each `id` (list is already newest-first). */
function dedupeNewestFirst(list: SearchAssetItem[]): SearchAssetItem[] {
  const seen = new Set<string>();
  const out: SearchAssetItem[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function readRecentSearches(): SearchAssetItem[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
  const next = dedupeNewestFirst(raw).slice(0, MAX_RECENT_SEARCHES);
  if (next.length !== raw.length) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }
  return next;
}

/**
 * Call when user opens an asset from search (or peers / charting picker).
 * Moves `item` to the front; drops the oldest entry when already at {@link MAX_RECENT_SEARCHES}.
 */
export function recordSearchNavigation(item: SearchAssetItem): void {
  if (typeof window === "undefined") return;
  const prev = readRecentSearches().filter((r) => r.id !== item.id);
  const next = [item, ...prev].slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Drops one entry from recents only; does not touch watchlist. */
export function removeRecentSearchById(id: string): void {
  if (typeof window === "undefined") return;
  const next = readRecentSearches().filter((r) => r.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
