"use client";

/**
 * Client session caches for **market data** (prices, % changes, table rows).
 *
 * Two-layer eviction (better than "drop oldest on every write" blindly):
 * 1. **Segment generation** — when `marketSegment` changes (new 15m live slot or frozen day),
 *    the entire store is discarded. Old quotes must not mix with new.
 * 2. **LRU within segment** — while the segment is current, cap entry count and evict
 *    least-recently-used keys so sessionStorage does not grow without bound.
 */

export type SegmentLruSlot<T> = {
  value: T;
  touchedAt: number;
};

export type SegmentLruStore<T> = {
  marketSegment: string;
  /** Oldest-first key order for LRU eviction. */
  order: string[];
  slots: Record<string, SegmentLruSlot<T>>;
};

function readStore<T>(storageKey: string): SegmentLruStore<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as SegmentLruStore<T>;
    if (typeof p.marketSegment !== "string" || !p.slots || typeof p.slots !== "object") return null;
    if (!Array.isArray(p.order)) p.order = [];
    return p;
  } catch {
    return null;
  }
}

function writeStore<T>(storageKey: string, store: SegmentLruStore<T>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function touchKey(store: SegmentLruStore<unknown>, key: string): void {
  store.order = store.order.filter((k) => k !== key);
  store.order.push(key);
  const slot = store.slots[key];
  if (slot) slot.touchedAt = Date.now();
}

function evictOldest(store: SegmentLruStore<unknown>, maxEntries: number): void {
  while (store.order.length > maxEntries) {
    const evict = store.order.shift();
    if (!evict) break;
    delete store.slots[evict];
  }
}

function ensureStore<T>(storageKey: string, marketSegment: string): SegmentLruStore<T> {
  const cur = readStore<T>(storageKey);
  if (cur && cur.marketSegment === marketSegment) return cur;
  return { marketSegment, order: [], slots: {} };
}

/** Drop entire bucket when the US market session segment advances. */
export function resetSegmentLruIfStale(storageKey: string, marketSegment: string): void {
  const cur = readStore(storageKey);
  if (!cur || cur.marketSegment === marketSegment) return;
  writeStore(storageKey, { marketSegment, order: [], slots: {} });
}

export function readSegmentLruEntry<T>(storageKey: string, marketSegment: string, key: string): T | null {
  const store = readStore<T>(storageKey);
  if (!store || store.marketSegment !== marketSegment) return null;
  const slot = store.slots[key];
  if (!slot) return null;
  touchKey(store as SegmentLruStore<unknown>, key);
  writeStore(storageKey, store);
  return slot.value;
}

export function writeSegmentLruEntry<T>(
  storageKey: string,
  marketSegment: string,
  key: string,
  value: T,
  maxEntries: number,
): void {
  if (!marketSegment || maxEntries < 1) return;
  const store = ensureStore<T>(storageKey, marketSegment);
  store.slots[key] = { value, touchedAt: Date.now() };
  touchKey(store as SegmentLruStore<unknown>, key);
  evictOldest(store as SegmentLruStore<unknown>, maxEntries);
  writeStore(storageKey, store);
}
