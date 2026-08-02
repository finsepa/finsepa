import type { SearchAssetItem } from "@/lib/search/search-types";

const STORAGE_KEY_LEGACY = "finsepa-search-recent-v1";
/** Most recent first; oldest dropped when a new navigation is recorded past this cap. */
export const MAX_RECENT_SEARCHES = 10;

/** Stored recent row — same shape as search results plus optional sync timestamp. */
export type RecentSearchStoredItem = SearchAssetItem & {
  /** Epoch ms when this navigation was recorded (for cross-device merge). */
  recordedAt?: number;
};

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY_LEGACY}.u.${userId}`;
  return `${STORAGE_KEY_LEGACY}.guest`;
}

function isSearchAssetItem(x: unknown): x is SearchAssetItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "stock" || o.type === "crypto" || o.type === "index" || o.type === "superinvestor") &&
    typeof o.symbol === "string" &&
    typeof o.name === "string" &&
    typeof o.route === "string"
  );
}

function withRecordedAt(item: SearchAssetItem, recordedAt?: number): RecentSearchStoredItem {
  const at =
    typeof recordedAt === "number" && Number.isFinite(recordedAt) ? recordedAt : undefined;
  return at != null ? { ...item, recordedAt: at } : { ...item };
}

/** Normalize API / localStorage payloads into valid recent-search rows. */
export function normalizeRecentSearchItems(raw: unknown): RecentSearchStoredItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentSearchStoredItem[] = [];
  for (const x of raw) {
    if (!isSearchAssetItem(x)) continue;
    const o = x as SearchAssetItem & { recordedAt?: unknown };
    const recordedAt =
      typeof o.recordedAt === "number" && Number.isFinite(o.recordedAt) ? o.recordedAt : undefined;
    out.push(
      withRecordedAt(
        {
          id: o.id,
          type: o.type,
          symbol: o.symbol,
          name: o.name,
          subtitle: typeof o.subtitle === "string" || o.subtitle === null ? o.subtitle : null,
          logoUrl: typeof o.logoUrl === "string" || o.logoUrl === null ? o.logoUrl : null,
          route: o.route,
          marketLabel:
            typeof o.marketLabel === "string" || o.marketLabel === null ? o.marketLabel : null,
        },
        recordedAt,
      ),
    );
  }
  return out;
}

function recordedAtOf(item: RecentSearchStoredItem, fallbackIndex: number, listLen: number): number {
  if (typeof item.recordedAt === "number" && Number.isFinite(item.recordedAt)) {
    return item.recordedAt;
  }
  // Legacy rows without timestamps: preserve relative newest-first order.
  return listLen - fallbackIndex;
}

/**
 * Union two newest-first lists without dropping either side's unique entries.
 * Same `id` keeps the newer `recordedAt` (or first-list relative order for legacy rows).
 */
export function mergeRecentSearchLists(
  primary: readonly RecentSearchStoredItem[],
  secondary: readonly RecentSearchStoredItem[],
): RecentSearchStoredItem[] {
  const byId = new Map<string, RecentSearchStoredItem>();

  const ingest = (list: readonly RecentSearchStoredItem[]) => {
    list.forEach((item, index) => {
      const nextAt = recordedAtOf(item, index, list.length);
      const prev = byId.get(item.id);
      if (!prev) {
        byId.set(item.id, { ...item, recordedAt: nextAt });
        return;
      }
      const prevAt = recordedAtOf(prev, 0, 1);
      if (nextAt >= prevAt) {
        byId.set(item.id, { ...item, recordedAt: nextAt });
      }
    });
  };

  // Secondary first, then primary wins ties — callers pass local/client as primary.
  ingest(secondary);
  ingest(primary);

  return [...byId.values()]
    .sort((a, b) => (b.recordedAt ?? 0) - (a.recordedAt ?? 0))
    .slice(0, MAX_RECENT_SEARCHES);
}

function readRawFromKey(key: string): RecentSearchStoredItem[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeRecentSearchItems(JSON.parse(window.localStorage.getItem(key) ?? "null"));
  } catch {
    return [];
  }
}

function writeRawToKey(key: string, list: RecentSearchStoredItem[]): void {
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
 * Signed-in users also sync via `/api/search/recent` (see {@link useSearchRecentStorage}).
 */
export function readRecentSearches(userId: string | null = null): RecentSearchStoredItem[] {
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

  const next = mergeRecentSearchLists(raw, []).slice(0, MAX_RECENT_SEARCHES);
  if (JSON.stringify(next) !== JSON.stringify(raw)) {
    writeRawToKey(key, next);
  }
  return next;
}

/**
 * Call when user opens an asset from search (or peers / charting picker).
 * Moves `item` to the front; drops the oldest entry when already at {@link MAX_RECENT_SEARCHES}.
 */
export function recordSearchNavigation(
  item: SearchAssetItem,
  userId: string | null = null,
): RecentSearchStoredItem[] {
  if (typeof window === "undefined") return [];
  const stamped = withRecordedAt(item, Date.now());
  const prev = readRecentSearches(userId).filter((r) => r.id !== item.id);
  const next = [stamped, ...prev].slice(0, MAX_RECENT_SEARCHES);
  writeRawToKey(storageKeyForUser(userId), next);
  return next;
}

/** Drops one entry from recents only; does not touch watchlist. */
export function removeRecentSearchById(
  id: string,
  userId: string | null = null,
): RecentSearchStoredItem[] {
  if (typeof window === "undefined") return [];
  const next = readRecentSearches(userId).filter((r) => r.id !== id);
  writeRawToKey(storageKeyForUser(userId), next);
  return next;
}

/** Replace the local cache after a successful server merge (signed-in only). */
export function writeRecentSearches(
  items: RecentSearchStoredItem[],
  userId: string | null,
): void {
  if (typeof window === "undefined" || !userId) return;
  writeRawToKey(
    storageKeyForUser(userId),
    mergeRecentSearchLists(items, []).slice(0, MAX_RECENT_SEARCHES),
  );
}
