"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchSearchItems } from "@/lib/search/fetch-search-items";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { useSearchRecentStorage } from "@/lib/search/use-search-recent-storage";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";

import { getSearchPanelViewState, SEARCH_CLIENT_DEBOUNCE_MS } from "@/lib/search/search-policy";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function isWatchedItem(item: SearchAssetItem, watched: Set<string>): boolean {
  return isWatchlistTickerWatched(watched, watchlistStorageKeyForSearchItem(item));
}

export function useSearchPanel({
  open,
  onClose,
  onSelectItem,
}: {
  open: boolean;
  onClose: () => void;
  onSelectItem?: (item: SearchAssetItem) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchGenRef = useRef(0);
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();
  const { readRecent, recordRecent, removeRecent, userId, authReady } = useSearchRecentStorage();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, SEARCH_CLIENT_DEBOUNCE_MS);
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  /** -1 = no keyboard row selected (avoids highlighting the first recent item on open). */
  const [highlight, setHighlight] = useState(-1);

  const debouncedTrim = debounced.trim();
  const queryTrim = query.trim();

  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    setRecent(readRecent());
  }, [open, readRecent, userId, authReady]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlight(-1);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(-1);
  }, [debouncedTrim]);

  useEffect(() => {
    if (!open || debouncedTrim.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }

    const gen = ++searchGenRef.current;
    const ac = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const next = await fetchSearchItems(debouncedTrim, ac.signal);
        if (gen !== searchGenRef.current) return;
        setItems(next);
      } catch (e) {
        if (gen !== searchGenRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setItems([]);
      } finally {
        if (gen === searchGenRef.current) setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [debouncedTrim, open]);

  const navigateTo = useCallback(
    (item: SearchAssetItem) => {
      recordRecent(item);
      setRecent(readRecent());
      if (onSelectItem) {
        onSelectItem(item);
        onClose();
        return;
      }
      router.push(item.route);
      onClose();
    },
    [onClose, onSelectItem, readRecent, recordRecent, router],
  );

  const handleRemoveRecent = useCallback((id: string) => {
    removeRecent(id);
    const next = readRecent();
    setRecent(next);
    setHighlight((h) => (h < 0 ? -1 : Math.min(h, Math.max(0, next.length - 1))));
  }, [readRecent, removeRecent]);

  useEffect(() => {
    if (!open) return;
    function onK(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const list = queryTrim.length > 0 ? items : recent;
      if (list.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h < 0 ? 0 : h + 1, list.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, -1));
      } else if (e.key === "Enter") {
        const row = highlight >= 0 ? list[highlight] : undefined;
        if (row) {
          e.preventDefault();
          navigateTo(row);
        }
      }
    }
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, [open, queryTrim, items, recent, highlight, navigateTo, onClose]);

  const { emptyQuery, searchPending, showStaleList, noResults } = getSearchPanelViewState({
    queryTrim,
    debouncedTrim,
    loading,
    resultCount: items.length,
  });
  const noRecent = emptyQuery && recent.length === 0;

  const isWatched = useCallback(
    (item: SearchAssetItem) => isWatchedItem(item, watchedUnion),
    [watchedUnion],
  );

  return {
    inputRef,
    query,
    setQuery,
    queryTrim,
    items,
    loading,
    recent,
    highlight,
    navigateTo,
    handleRemoveRecent,
    emptyQuery,
    noRecent,
    searchPending,
    showStaleList,
    noResults,
    isWatched,
    watchlistLoaded: loaded,
    watchlistStorageHydrated: storageHydrated,
    toggleTicker,
    watchlists,
    activeWatchlistId,
    watched: watchedUnion,
  };
}
