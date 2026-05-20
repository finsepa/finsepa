"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchSearchItems } from "@/lib/search/fetch-search-items";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { readRecentSearches, recordSearchNavigation, removeRecentSearchById } from "@/lib/search/recent-searches-storage";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";

const SEARCH_DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function isWatchedItem(item: SearchAssetItem, watched: Set<string>): boolean {
  const k = watchlistStorageKeyForSearchItem(item).trim().toUpperCase();
  return watched.has(k);
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
  const { watched, loaded, toggleTicker } = useWatchlist();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  const [highlight, setHighlight] = useState(0);

  const debouncedTrim = debounced.trim();
  const queryTrim = query.trim();

  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    setRecent(readRecentSearches());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
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
      recordSearchNavigation(item);
      setRecent(readRecentSearches());
      if (onSelectItem) {
        onSelectItem(item);
        onClose();
        return;
      }
      router.push(item.route);
      onClose();
    },
    [onClose, onSelectItem, router],
  );

  const handleRemoveRecent = useCallback((id: string) => {
    removeRecentSearchById(id);
    const next = readRecentSearches();
    setRecent(next);
    setHighlight((h) => Math.min(h, Math.max(0, next.length - 1)));
  }, []);

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
        setHighlight((h) => Math.min(h + 1, list.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        const row = list[highlight];
        if (row) {
          e.preventDefault();
          navigateTo(row);
        }
      }
    }
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, [open, queryTrim, items, recent, highlight, navigateTo, onClose]);

  const showResults = queryTrim.length > 0;
  const emptyQuery = !showResults;
  const noRecent = emptyQuery && recent.length === 0;
  const showStaleList = showResults && items.length > 0;
  const noResults = showResults && !loading && items.length === 0;

  const isWatched = useCallback((item: SearchAssetItem) => isWatchedItem(item, watched), [watched]);

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
    showStaleList,
    noResults,
    isWatched,
    watchlistLoaded: loaded,
    toggleTicker,
  };
}
