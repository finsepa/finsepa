"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "@/lib/icons";
import { fieldChromeClassName, textInputShellClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

import type { SearchAssetItem } from "@/lib/search/search-types";
import { useSearchRecentStorage } from "@/lib/search/use-search-recent-storage";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
import { SearchResultRow } from "@/components/search/search-result-row";
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

export function NewsMobileSearchSheet({
  tab,
  initialQuery,
  placeholder = "Search for news or tickers",
}: {
  tab: string;
  initialQuery: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();
  const { readRecent, removeRecent, clearRecent, userId, authReady } = useSearchRecentStorage();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, SEARCH_CLIENT_DEBOUNCE_MS);
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  const [highlight, setHighlight] = useState(0);

  const queryTrim = query.trim();
  const debouncedTrim = debounced.trim();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    // focus after paint
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, readRecent, userId, authReady]);

  useEffect(() => setHighlight(0), [debouncedTrim]);

  useEffect(() => {
    if (!open) return;
    if (debouncedTrim.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedTrim)}`, {
          signal: ac.signal,
          cache: "default",
        });
        const json = (await res.json()) as { items?: SearchAssetItem[] };
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, debouncedTrim]);

  const close = useCallback(() => setOpen(false), []);

  const applyQuery = useCallback(
    (nextQ: string) => {
      const p = new URLSearchParams();
      p.set("tab", tab);
      if (nextQ.trim()) p.set("q", nextQ.trim());
      p.set("page", "1");
      router.push(`/news?${p.toString()}`);
    },
    [router, tab],
  );

  const handleDone = useCallback(() => {
    applyQuery(query);
    close();
  }, [applyQuery, close, query]);

  const handleSelectItem = useCallback(
    (item: SearchAssetItem) => {
      applyQuery(item.symbol);
      close();
    },
    [applyQuery, close],
  );

  const handleRemoveRecent = useCallback((id: string) => {
    removeRecent(id);
    const next = readRecent();
    setRecent(next);
    setHighlight((h) => Math.min(h, Math.max(0, next.length - 1)));
  }, [readRecent, removeRecent]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
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
          handleSelectItem(row);
        } else {
          e.preventDefault();
          handleDone();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, handleDone, handleSelectItem, highlight, items, open, queryTrim, recent]);

  const { emptyQuery, searchPending, showStaleList, noResults } = getSearchPanelViewState({
    queryTrim,
    debouncedTrim,
    loading,
    resultCount: items.length,
  });
  const noRecent = emptyQuery && recent.length === 0;

  const triggerLabel = useMemo(() => (initialQuery?.trim() ? initialQuery.trim() : "Search..."), [initialQuery]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-[10px] px-3 text-left",
          textInputShellClassName,
        )}
        aria-label="Search news"
      >
        <Search className="h-5 w-5 shrink-0 text-icon" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm leading-5 text-fg-subtle">{triggerLabel}</span>
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[120] md:hidden" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Close search"
                onClick={close}
              />
              <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-[0_-8px_30px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-12))]">
                <div className="flex items-center justify-between px-4 pb-3 pt-4">
                  <div className="flex-1 text-center text-[16px] font-semibold leading-6 text-fg">
                    Search
                  </div>
                  <button
                    type="button"
                    onClick={handleDone}
                    className="ml-3 shrink-0 text-[15px] font-semibold text-fg"
                  >
                    Done
                  </button>
                </div>

                <div className="px-4 pb-3">
                  <div className="relative block w-full">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-icon"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      ref={inputRef}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={placeholder}
                      className={cn(
                        fieldChromeClassName,
                        "box-border h-11 w-full rounded-[10px] py-0 pl-10 pr-3 text-[15px] text-fg placeholder:text-fg-subtle outline-none",
                        "transition-[color,background-color,border-color,box-shadow]",
                        "dark:[&:not(:focus)]:hover:border-field-stroke-hover",
                        "focus:shadow-[0_0_0_2px_var(--fs-field-ring)] focus-visible:outline-none",
                      )}
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  </div>
                </div>

                <div className="max-h-[min(58vh,520px)] overflow-y-auto pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  {emptyQuery ? (
                    <>
                      <div className="px-4 pb-2 pt-1 text-[12px] font-semibold text-fg">
                        Recent
                        {!noRecent ? (
                          <button
                            type="button"
                            onClick={() => {
                              clearRecent();
                              setRecent([]);
                              setHighlight(0);
                            }}
                            className="float-right text-[12px] font-medium text-accent"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {noRecent ? (
                        <div className="px-4 py-10 text-center text-[14px] text-fg-muted">
                          No recent searches yet.
                        </div>
                      ) : (
                        recent.map((item, i) => (
                          <SearchResultRow
                            key={item.id}
                            variant="recent"
                            item={item}
                            onNavigate={handleSelectItem}
                            onRemoveRecent={() => handleRemoveRecent(item.id)}
                            active={highlight === i}
                            starred={isWatchedItem(item, watchedUnion)}
                            watched={watchedUnion}
                            watchlists={watchlists}
                            activeWatchlistId={activeWatchlistId}
                            loaded={loaded}
                            storageHydrated={storageHydrated}
                            toggleTicker={toggleTicker}
                          />
                        ))
                      )}
                    </>
                  ) : searchPending && !showStaleList ? (
                    <SearchLoadingIndicator className="px-4 py-10" />
                  ) : noResults ? (
                    <div className="px-4 py-10 text-center text-[14px] text-fg-muted">
                      No results for “{queryTrim}”
                    </div>
                  ) : (
                    <>
                      {loading && showStaleList ? (
                        <div className="px-4 pb-1 text-center text-[11px] text-fg-subtle" aria-hidden>
                          Updating…
                        </div>
                      ) : null}
                      {items.map((item, i) => (
                        <SearchResultRow
                          key={item.id}
                          variant="live"
                          item={item}
                          onNavigate={handleSelectItem}
                          active={highlight === i}
                          starred={isWatchedItem(item, watchedUnion)}
                          watched={watchedUnion}
                          watchlists={watchlists}
                          activeWatchlistId={activeWatchlistId}
                          loaded={loaded}
                          storageHydrated={storageHydrated}
                          toggleTicker={toggleTicker}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

