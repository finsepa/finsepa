"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "@/lib/icons";

import { fetchSearchItems } from "@/lib/search/fetch-search-items";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { readRecentSearches, recordSearchNavigation, removeRecentSearchById } from "@/lib/search/recent-searches-storage";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import { SearchPanelResults } from "@/components/search/search-panel-results";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";
import { getSearchPanelViewState } from "@/lib/search/search-policy";

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
  return isWatchlistTickerWatched(watched, watchlistStorageKeyForSearchItem(item));
}

export type SearchModalVariant = "default" | "fullscreen";

export function SearchModal({
  onClose,
  variant = "default",
  onSelectItem,
}: {
  onClose: () => void;
  /** `fullscreen` = full-viewport panel (e.g. peer picker). `default` = centered card + dimmed backdrop. */
  variant?: SearchModalVariant;
  /** When set, invoked on result selection instead of client navigation (e.g. add stock to peers; caller may navigate for other types). */
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
  const [highlight, setHighlight] = useState(-1);

  const debouncedTrim = debounced.trim();
  const queryTrim = query.trim();

  const fullscreen = variant === "fullscreen";

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    setHighlight(-1);
  }, [debouncedTrim]);

  useEffect(() => {
    if (debouncedTrim.length < 1) {
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
  }, [debouncedTrim]);

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
    setHighlight((h) => (h < 0 ? -1 : Math.min(h, Math.max(0, next.length - 1))));
  }, []);

  useEffect(() => {
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
  }, [queryTrim, items, recent, highlight, navigateTo, onClose]);

  const { emptyQuery, searchPending, showStaleList, noResults } = getSearchPanelViewState({
    queryTrim,
    debouncedTrim,
    loading,
    resultCount: items.length,
  });
  const noRecent = emptyQuery && recent.length === 0;

  const resultsContent = (
    <SearchPanelResults
      emptyQuery={emptyQuery}
      noRecent={noRecent}
      recent={recent}
      queryTrim={queryTrim}
      loading={loading}
      searchPending={searchPending}
      showStaleList={showStaleList}
      noResults={noResults}
      items={items}
      highlight={highlight}
      onNavigate={navigateTo}
      onRemoveRecent={handleRemoveRecent}
      isWatched={(item) => isWatchedItem(item, watched)}
      watchlistLoaded={loaded}
      toggleTicker={toggleTicker}
      listClassName={cn(
        fullscreen ? "min-h-0 flex-1" : "max-h-[min(420px,60dvh)]",
        "overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
      )}
    />
  );

  return (
    <AppModalOverlay
      open
      onClose={fullscreen ? undefined : onClose}
      zIndex={100}
      align={fullscreen ? "fullscreen" : "top"}
      shellEffect={!fullscreen}
    >
      <AppModalShell
        showClose={false}
        maxWidthClass={fullscreen ? "w-full" : "w-full max-w-[640px]"}
        className={fullscreen ? "flex min-h-0 w-full flex-1 flex-col" : undefined}
        dialogClassName={fullscreen ? "flex min-h-0 flex-1 flex-col" : undefined}
        bareBody={fullscreen}
        bodyScroll={false}
        header={
          <div
            className={
              fullscreen
                ? "flex w-full items-center gap-3 border-b border-[#E4E4E7] px-6 py-4 sm:px-9"
                : "flex w-full items-center gap-3"
            }
          >
            <Search className="h-5 w-5 shrink-0 text-[#71717A]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Apple, NVIDIA, Bitcoin, Ethereum, S&P 500…"
              className="flex-1 bg-transparent text-[15px] leading-6 text-[#09090B] outline-none placeholder:text-[#A1A1AA]"
              autoComplete="off"
              autoCorrect="off"
            />
            <kbd
              onClick={onClose}
              className="cursor-pointer select-none rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-1 text-[12px] font-medium text-[#71717A] transition-colors hover:bg-[#E4E4E7]"
            >
              ESC
            </kbd>
          </div>
        }
        headerClassName={fullscreen ? "shrink-0 bg-white px-0 py-0" : undefined}
        bodyClassName={fullscreen ? undefined : "p-0"}
        cardClassName={fullscreen ? undefined : "overflow-hidden"}
      >
        {fullscreen ? (
          <div className="flex min-h-0 flex-1 flex-col bg-white">{resultsContent}</div>
        ) : (
          resultsContent
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}

/** Dispatched globally so any UI (e.g. stock bottom bar) can open the same modal as the top bar. */
export const OPEN_SEARCH_EVENT = "finsepa-open-search";

export function requestOpenSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
