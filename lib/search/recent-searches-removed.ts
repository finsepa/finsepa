import type { RecentSearchStoredItem } from "@/lib/search/recent-searches-storage";

/** id → ISO removedAt */
export type RecentSearchRemovedMap = Record<string, string>;

function recordedAtMs(item: RecentSearchStoredItem): number {
  if (typeof item.recordedAt === "number" && Number.isFinite(item.recordedAt)) {
    return item.recordedAt;
  }
  return 0;
}

export function normalizeRemovedMap(raw: unknown): RecentSearchRemovedMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RecentSearchRemovedMap = {};
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof at !== "string" || !at.trim()) continue;
    if (!Number.isFinite(Date.parse(at))) continue;
    out[id] = at;
  }
  return out;
}

/** Drop items tombstoned after their recordedAt (re-add with newer recordedAt wins). */
export function filterAfterRemoved(
  items: RecentSearchStoredItem[],
  removed: RecentSearchRemovedMap,
): RecentSearchStoredItem[] {
  const entries = Object.entries(removed);
  if (entries.length === 0) return items;
  return items.filter((item) => {
    const at = removed[item.id];
    if (!at) return true;
    const removedMs = Date.parse(at);
    if (!Number.isFinite(removedMs)) return true;
    return recordedAtMs(item) >= removedMs;
  });
}

/** Drop tombstones superseded by a newer recorded item (user searched again). */
export function pruneRemovedAgainstItems(
  removed: RecentSearchRemovedMap,
  items: RecentSearchStoredItem[],
): RecentSearchRemovedMap {
  if (Object.keys(removed).length === 0) return removed;
  const next: RecentSearchRemovedMap = { ...removed };
  for (const item of items) {
    const at = next[item.id];
    if (!at) continue;
    const removedMs = Date.parse(at);
    if (!Number.isFinite(removedMs) || recordedAtMs(item) >= removedMs) {
      delete next[item.id];
    }
  }
  return next;
}
