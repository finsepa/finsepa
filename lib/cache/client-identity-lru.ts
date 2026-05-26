"use client";

/**
 * Long-lived company identity (name + logo) — **TTL + LRU**, not market segment.
 * Segment invalidation does not apply; entries expire after 7d or when over capacity.
 */

export const DEFAULT_IDENTITY_LRU_MAX_ENTRIES = 800;

export type IdentityLruEntry = {
  name: string;
  logoUrl: string;
  expiresAt: number;
  lastAccessedAt: number;
};

export type IdentityLruStore = Record<string, IdentityLruEntry>;

export function pruneIdentityStore(store: IdentityLruStore, now: number): IdentityLruStore {
  const out: IdentityLruStore = {};
  for (const [ticker, entry] of Object.entries(store)) {
    if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > now) {
      out[ticker] = entry;
    }
  }
  return out;
}

/** Evict least-recently-used tickers until at most `maxEntries` remain. */
export function evictIdentityLru(store: IdentityLruStore, maxEntries: number): IdentityLruStore {
  const keys = Object.keys(store);
  if (keys.length <= maxEntries) return store;
  const sorted = keys.sort((a, b) => (store[a]!.lastAccessedAt ?? 0) - (store[b]!.lastAccessedAt ?? 0));
  const drop = sorted.slice(0, keys.length - maxEntries);
  const out = { ...store };
  for (const k of drop) delete out[k];
  return out;
}

export function touchIdentityEntry(entry: IdentityLruEntry, now: number): IdentityLruEntry {
  return { ...entry, lastAccessedAt: now };
}
