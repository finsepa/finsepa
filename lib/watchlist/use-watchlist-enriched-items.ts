"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyWatchlistScreenerIdentity, persistWatchlistStockIdentities } from "@/lib/watchlist/apply-watchlist-identity";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import { logWatchlistEnrich } from "@/lib/watchlist/enrich-debug";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { fetchWatchlistEnriched } from "@/lib/watchlist/fetch-watchlist-enriched";
import { buildWatchlistShellItems } from "@/lib/watchlist/watchlist-shell-items";
import { clearWatchlistEnrichedCache, readLastWatchlistEnrichedMarketSegment, readWatchlistEnrichedCache, readWatchlistEnrichedSessionCache } from "@/lib/watchlist/watchlist-enriched-cache";
import { buildWatchlistMembershipKey } from "@/lib/watchlist/watchlist-membership-key";
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

function primeItemsFromCacheOrShell(tickers: string[], membershipKey: string): WatchlistEnrichedItem[] {
  const watchedSet = new Set(tickers);

  const memory = readWatchlistEnrichedCache(membershipKey);
  if (memory?.length) {
    return sortEnrichedItemsByTickerOrder(
      applyWatchlistScreenerIdentity(memory).filter((row) => itemStillWatched(row, watchedSet)),
      tickers,
    );
  }

  const segment = readLastWatchlistEnrichedMarketSegment();
  if (segment) {
    const session = readWatchlistEnrichedSessionCache(segment, membershipKey);
    if (session?.length) {
      return sortEnrichedItemsByTickerOrder(
        applyWatchlistScreenerIdentity(session).filter((row) => itemStillWatched(row, watchedSet)),
        tickers,
      );
    }
  }

  return sortEnrichedItemsByTickerOrder(buildWatchlistShellItems(tickers), tickers);
}

export function useWatchlistEnrichedItems(options: UseWatchlistEnrichedItemsOptions = {}) {
  const { enabled = true } = options;
  const { watchedTickers, storageHydrated } = useWatchlist();
  const membershipKey = useMemo(() => buildWatchlistMembershipKey(watchedTickers), [watchedTickers]);

  const [items, setItems] = useState<WatchlistEnrichedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const everHadRowsRef = useRef(false);
  const watchedRef = useRef(watchedTickers);
  watchedRef.current = watchedTickers;
  const loadGenRef = useRef(0);
  const lastLoadedMembershipKeyRef = useRef("");

  const load = useCallback(async () => {
    const tickers = [...watchedRef.current];
    if (tickers.length === 0) return;

    const keyForLoad = buildWatchlistMembershipKey(tickers);
    logWatchlistEnrich("enrichment_load_trigger");

    const gen = ++loadGenRef.current;
    const hadItems = everHadRowsRef.current;

    if (hadItems) {
      setLoading(true);
    }
    setError(null);
    try {
      const { stocks, crypto, indices } = await fetchWatchlistEnriched(keyForLoad, tickers);
      if (gen !== loadGenRef.current) return;
      if (buildWatchlistMembershipKey(watchedRef.current) !== keyForLoad) return;

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
      lastLoadedMembershipKeyRef.current = keyForLoad;
      setError(null);
    } catch {
      if (gen !== loadGenRef.current) return;
      if (buildWatchlistMembershipKey(watchedRef.current) !== keyForLoad) return;
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
  }, []);

  useEffect(() => {
    if (!storageHydrated || !enabled) return;
    if (!membershipKey) {
      loadGenRef.current += 1;
      everHadRowsRef.current = false;
      lastLoadedMembershipKeyRef.current = "";
      clearWatchlistEnrichedCache();
      setItems([]);
      setLoading(false);
      setReady(true);
      setError(null);
      return;
    }

    loadGenRef.current += 1;
    setError(null);

    const primed = primeItemsFromCacheOrShell(watchedRef.current, membershipKey);
    setItems(primed);
    setReady(primed.length > 0);
    everHadRowsRef.current = primed.length > 0;

    void load();
  }, [storageHydrated, membershipKey, load, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onMutated = () => {
      if (watchedRef.current.length === 0) return;
      const key = buildWatchlistMembershipKey(watchedRef.current);
      if (key === lastLoadedMembershipKeyRef.current) {
        logWatchlistEnrich("enrichment_skipped_layout_only");
        return;
      }
      void load();
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
