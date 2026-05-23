"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import {
  clearWatchlistEnrichedCache,
  readWatchlistEnrichedCache,
  writeWatchlistEnrichedCache,
} from "@/lib/watchlist/watchlist-enriched-cache";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

function itemStillWatched(item: WatchlistEnrichedItem, watched: Set<string>): boolean {
  return watched.has(item.storageKey.trim().toUpperCase());
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

export function useWatchlistEnrichedItems() {
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

    const key = [...tickers].sort().join("|");
    const hadItems =
      everHadRowsRef.current || (readWatchlistEnrichedCache(key)?.length ?? 0) > 0;

    if (hadItems) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/watchlist/enrich", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (!res.ok) {
        setError("Could not load watchlist.");
        if (!hadItems) {
          setItems([]);
          everHadRowsRef.current = false;
          clearWatchlistEnrichedCache();
        }
        setReady(true);
        return;
      }
      const data = (await res.json()) as {
        stocks?: WatchlistEnrichedItem[];
        crypto?: WatchlistEnrichedItem[];
        indices?: WatchlistEnrichedItem[];
      };
      const s = Array.isArray(data.stocks) ? data.stocks : [];
      const c = Array.isArray(data.crypto) ? data.crypto : [];
      const i = Array.isArray(data.indices) ? data.indices : [];
      const merged = [...s, ...c, ...i];
      setItems((prev) => {
        const next = mergeWatchlistQuotes(prev, merged);
        writeWatchlistEnrichedCache(key, next);
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
  }, [watched]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (watched.size === 0) {
      everHadRowsRef.current = false;
      clearWatchlistEnrichedCache();
      setItems([]);
      setLoading(false);
      setReady(true);
      setError(null);
      return;
    }

    const cached = readWatchlistEnrichedCache(watchedKey);
    if (cached) {
      setItems(cached);
      setReady(true);
      everHadRowsRef.current = true;
    } else {
      setItems((prev) => {
        const next = prev.filter((row) => itemStillWatched(row, watched));
        if (next.length > 0) {
          setReady(true);
          everHadRowsRef.current = true;
        }
        return next;
      });
    }

    void load();
  }, [storageHydrated, watchedKey, load, watched]);

  useEffect(() => {
    const onMutated = () => {
      if (watched.size > 0) void load();
    };
    window.addEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
    return () => window.removeEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
  }, [load, watched.size]);

  const showSkeleton =
    storageHydrated && watched.size > 0 && items.length === 0 && !ready && !error;
  const pricesLoading = loading && items.length > 0;

  return {
    items,
    loading,
    pricesLoading,
    ready,
    error,
    empty: storageHydrated && watched.size === 0,
    showSkeleton,
    watchedCount: watched.size,
  };
}
