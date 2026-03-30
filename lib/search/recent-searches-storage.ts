import type { SearchAssetItem } from "@/lib/search/search-types";

const STORAGE_KEY = "finsepa-search-recent-v1";
const MAX_RECENT = 10;

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

export function readRecentSearches(): SearchAssetItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

/** Call when user opens an asset from the search modal (result row). */
export function recordSearchNavigation(item: SearchAssetItem): void {
  if (typeof window === "undefined") return;
  const prev = readRecentSearches().filter((r) => r.id !== item.id);
  const next = [item, ...prev].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Drops one entry from recents only; does not touch watchlist. */
export function removeRecentSearchById(id: string): void {
  if (typeof window === "undefined") return;
  const next = readRecentSearches().filter((r) => r.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
