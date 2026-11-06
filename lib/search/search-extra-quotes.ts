"use client";

import type { SearchDirectoryQuote } from "@/lib/search/search-directory-types";

/** Quotes for search rows outside the browse directory (recents, hits). `null` = known to have no quote. */
const cache = new Map<string, SearchDirectoryQuote | null>();
const inflight = new Map<string, Promise<void>>();

const MAX_SYMBOLS_PER_REQUEST = 50;

export function readSearchExtraQuotes(): Map<string, SearchDirectoryQuote | null> {
  return new Map(cache);
}

export function hasSearchExtraQuote(symbol: string): boolean {
  return cache.has(symbol);
}

/**
 * Fetch quotes for symbols not cached or already loading. Requests are shared and never aborted, so a
 * re-render (e.g. the directory arriving) cannot cancel a fetch another caller is waiting on.
 */
export function loadSearchExtraQuotes(symbols: readonly string[]): Promise<void> {
  const wanted = [...new Set(symbols)];
  const toFetch = wanted.filter((s) => !cache.has(s) && !inflight.has(s)).slice(0, MAX_SYMBOLS_PER_REQUEST);
  if (toFetch.length) {
    const request = fetch(`/api/search/quotes?symbols=${encodeURIComponent(toFetch.join(","))}`)
      .then(async (res) => {
        if (!res.ok) return;
        const { quotes } = (await res.json()) as { quotes: Record<string, SearchDirectoryQuote> };
        for (const s of toFetch) cache.set(s, quotes[s] ?? null);
      })
      .catch(() => {
        /* offline — cells stay "—" and the next open retries */
      })
      .finally(() => {
        for (const s of toFetch) inflight.delete(s);
      });
    for (const s of toFetch) inflight.set(s, request);
  }
  const pending = wanted.map((s) => inflight.get(s)).filter((p): p is Promise<void> => p != null);
  return Promise.all(pending).then(() => undefined);
}
