"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyWatchlistScreenerIdentity, persistWatchlistStockIdentities } from "@/lib/watchlist/apply-watchlist-identity";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { fetchWatchlistEnriched } from "@/lib/watchlist/fetch-watchlist-enriched";
import { clearWatchlistEnrichedCache } from "@/lib/watchlist/watchlist-enriched-cache";
import { sortEnrichedItemsByTickerOrder } from "@/lib/watchlist/sort-enriched-items";
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
  const { watchedTickers, storageHydrated } = useWatchlist();
  const watchedKey = useMemo(() => watchedTickers.join("|"), [watchedTickers]);

  const [items, setItems] = useState<WatchlistEnrichedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const everHadRowsRef = useRef(false);
  const watchedRef = useRef(watchedTickers);
  watchedRef.current = watchedTickers;
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const tickers = [...watchedTickers];
    if (tickers.length === 0) return;

    const gen = ++loadGenRef.current;
    const watchedKeyForLoad = tickers.join("|");
    const hadItems = everHadRowsRef.current;

    if (hadItems) {
      setLoading(true);
    }
    setError(null);
    try {
      const { stocks, crypto, indices } = await fetchWatchlistEnriched(watchedKeyForLoad, tickers);
      if (gen !== loadGenRef.current) return;
      if (watchedRef.current.join("|") !== watchedKeyForLoad) return;

      const merged = sortEnrichedItemsByTickerOrder(
        applyWatchlistScreenerIdentity(groupsToItems({ stocks, crypto, indices })),
        watchedRef.current,
      );
      setItems((prev) => {
        const next = sortEnrichedItemsByTickerOrder(
          mergeWatchlistQuotes(prev, merged).filter((row) =>
            itemStillWatched(row, new Set(watchedRef.current)),
          ),
          watchedRef.current,
        );
        persistWatchlistStockIdentities(next);
        return next;
      });
      everHadRowsRef.current = merged.length > 0;
      setError(null);
    } catch {
      if (gen !== loadGenRef.current) return;
      if (watchedRef.current.join("|") !== watchedKeyForLoad) return;
      setError("Could not load watchlist.");
      if (!hadItems) {
        setItems([]);
        everHadRowsRef.current = false;
        clearWatchlistEnrichedCache();
      }
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
        setReady(true);
      }
    }
  }, [watchedTickers]);

  useEffect(() => {
    if (!storageHydrated || !enabled) return;
    if (watchedTickers.length === 0) {
      loadGenRef.current += 1;
      everHadRowsRef.current = false;
      clearWatchlistEnrichedCache();
      setItems([]);
      setLoading(false);
      setReady(true);
      setError(null);
      return;
    }

    loadGenRef.current += 1;
    setError(null);

    setItems((prev) => {
      const watchedSet = new Set(watchedTickers);
      const next = sortEnrichedItemsByTickerOrder(
        prev.filter((row) => itemStillWatched(row, watchedSet)),
        watchedTickers,
      );
      if (next.length === 0) {
        everHadRowsRef.current = false;
        setReady(false);
      } else {
        setReady(true);
        everHadRowsRef.current = true;
      }
      return next;
    });

    void load();
  }, [storageHydrated, watchedKey, load, watchedTickers, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onMutated = () => {
      if (watchedRef.current.length > 0) void load();
    };
    window.addEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
    return () => window.removeEventListener(WATCHLIST_MUTATED_EVENT, onMutated);
  }, [load, enabled]);

  const showSkeleton =
    enabled && storageHydrated && watchedTickers.length > 0 && items.length === 0 && !ready && !error;
  const pricesLoading = enabled && loading && items.length > 0;

  const stocks = useMemo(
    () => sortEnrichedItemsByTickerOrder(items.filter((r) => r.kind === "stock"), watchedTickers),
    [items, watchedTickers],
  );
  const crypto = useMemo(
    () => sortEnrichedItemsByTickerOrder(items.filter((r) => r.kind === "crypto"), watchedTickers),
    [items, watchedTickers],
  );
  const indices = useMemo(
    () => sortEnrichedItemsByTickerOrder(items.filter((r) => r.kind === "index"), watchedTickers),
    [items, watchedTickers],
  );

  return {
    items,
    stocks,
    crypto,
    indices,
    loading,
    pricesLoading,
    ready,
    error,
    empty: storageHydrated && watchedTickers.length === 0,
    showSkeleton,
    watchedCount: watchedTickers.length,
  };
}
