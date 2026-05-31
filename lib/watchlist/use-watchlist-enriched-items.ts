"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyWatchlistScreenerIdentity, persistWatchlistStockIdentities } from "@/lib/watchlist/apply-watchlist-identity";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { fetchWatchlistEnriched } from "@/lib/watchlist/fetch-watchlist-enriched";
import { clearWatchlistEnrichedCache } from "@/lib/watchlist/watchlist-enriched-cache";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

function itemStillWatched(item: WatchlistEnrichedItem, watched: Set<string>): boolean {
  return isWatchlistTickerWatched(watched, item.storageKey);
}

function mergeWatchlistQuotes(
  prev: WatchlistEnrichedItem[],
  next: WatchlistEnrichedItem[],
): WatchlistEnrichedItem[] {
  const prevByKey = new Map(prev.map((r) => [r.storageKey.trim().toUpperCase(), r]));
  return next.map((row) => {
    const old = prevByKey.get(row.storageKey.trim().toUpperCase());
    if (old && row.price == null && old.price != null) {
      return { ...row, price: old.price, pct1d: row.pct1d ?? old.pct1d };
    }
    return row;
  });
}

function groupsToItems(groups: {
  stocks: WatchlistEnrichedItem[];
  crypto: WatchlistEnrichedItem[];
  indices: WatchlistEnrichedItem[];
}): WatchlistEnrichedItem[] {
  return [...groups.stocks, ...groups.crypto, ...groups.indices];
}

export type UseWatchlistEnrichedItemsOptions = {
  /** When false, no enrich HTTP until the user opens the watchlist (e.g. expands the rail). */
  enabled?: boolean;
};

export function useWatchlistEnrichedItems(options: UseWatchlistEnrichedItemsOptions = {}) {
  const { enabled = true } = options;
  const { watched, storageHydrated } = useWatchlist();
  const watchedKey = useMemo(() => [...watched].sort().join("|"), [watched]);

  const [items, setItems] = useState<WatchlistEnrichedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const everHadRowsRef = useRef(false);

  const load = useCallback(async () => {
    const tickers = [...watched];
    if (tickers.length === 0) return;

    const hadItems = everHadRowsRef.current;

    if (hadItems) {
      setLoading(true);
    }
    setError(null);
    try {
      const { stocks, crypto, indices } = await fetchWatchlistEnriched(watchedKey, tickers);
      const merged = applyWatchlistScreenerIdentity(groupsToItems({ stocks, crypto, indices }));
      setItems((prev) => {
        const next = mergeWatchlistQuotes(prev, merged);
        persistWatchlistStockIdentities(next);
        return next;
      });
      everHadRowsRef.current = merged.length > 0;
    } catch {
      setError("Could not load watchlist.");
      if (!hadItems) {
        setItems([]);
        everHadRowsRef.current = false;
        clearWatchlistEnrichedCache();
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [watched, watchedKey]);

  useEffect(() => {
    if (!storageHydrated || !enabled) return;
    if (watched.size === 0) {
      everHadRowsRef.current = false;
      clearWatchlistEnrichedCache();
      setItems([]);
      setLoading(false);
      setReady(false);
      setError(null);
      return;
    }

    setItems((prev) => {
      const next = prev.filter((row) => itemStillWatched(row, watched));
      if (next.length > 0) {
        setReady(true);
        everHadRowsRef.current = true;
      }
      return next;
    });

    void load();
  }, [storageHydrated, watchedKey, load, watched, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onMutated = () => {
      if (watched.size > 0) void load();
    };
    window.addEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
    return () => window.removeEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
  }, [load, watched.size, enabled]);

  const showSkeleton =
    enabled && storageHydrated && watched.size > 0 && items.length === 0 && !ready && !error;
  const pricesLoading = enabled && loading && items.length > 0;

  const stocks = useMemo(() => items.filter((r) => r.kind === "stock"), [items]);
  const crypto = useMemo(() => items.filter((r) => r.kind === "crypto"), [items]);
  const indices = useMemo(() => items.filter((r) => r.kind === "index"), [items]);

  return {
    items,
    stocks,
    crypto,
    indices,
    loading,
    pricesLoading,
    ready,
    error,
    empty: storageHydrated && watched.size === 0,
    showSkeleton,
    watchedCount: watched.size,
  };
}
