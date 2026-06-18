import type { SearchAssetItem } from "@/lib/search/search-types";

const STORAGE_KEY_LEGACY = "finsepa-search-recent-v1";
/** Most recent first; oldest dropped when a new navigation is recorded past this cap. */
export const MAX_RECENT_SEARCHES = 10;

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY_LEGACY}.u.${userId}`;
  return `${STORAGE_KEY_LEGACY}.guest`;
}

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

function readRawFromKey(key: string): SearchAssetItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(key));
}

function writeRawToKey(key: string, list: SearchAssetItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Recent searches are scoped per signed-in user (same browser, separate accounts).
 * Guest browsing uses a guest key only — never merged into a new account on signup.
 */
export function readRecentSearches(userId: string | null = null): SearchAssetItem[] {
  if (typeof window === "undefined") return [];

  const key = storageKeyForUser(userId);
  let raw = readRawFromKey(key);

  // One-time migration: legacy global key → guest bucket only (not signed-in users).
  if (raw.length === 0 && !userId) {
    const legacy = readRawFromKey(STORAGE_KEY_LEGACY);
    if (legacy.length > 0) {
      raw = legacy;
      writeRawToKey(storageKeyForUser(null), legacy);
      try {
        window.localStorage.removeItem(STORAGE_KEY_LEGACY);
      } catch {
        /* ignore */
      }
    }
  }

  const next = dedupeNewestFirst(raw).slice(0, MAX_RECENT_SEARCHES);
  if (next.length !== raw.length) {
    writeRawToKey(key, next);
  }
  return next;
}

/**
 * Call when user opens an asset from search (or peers / charting picker).
 * Moves `item` to the front; drops the oldest entry when already at {@link MAX_RECENT_SEARCHES}.
 */
export function recordSearchNavigation(item: SearchAssetItem, userId: string | null = null): void {
  if (typeof window === "undefined") return;
  const prev = readRecentSearches(userId).filter((r) => r.id !== item.id);
  const next = [item, ...prev].slice(0, MAX_RECENT_SEARCHES);
  writeRawToKey(storageKeyForUser(userId), next);
}

/** Drops one entry from recents only; does not touch watchlist. */
export function removeRecentSearchById(id: string, userId: string | null = null): void {
  if (typeof window === "undefined") return;
  const next = readRecentSearches(userId).filter((r) => r.id !== id);
  writeRawToKey(storageKeyForUser(userId), next);
}
