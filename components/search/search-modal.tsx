"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import type { SearchAssetItem } from "@/lib/search/search-types";
import { readRecentSearches, recordSearchNavigation, removeRecentSearchById } from "@/lib/search/recent-searches-storage";
import { SearchResultRow } from "@/components/search/search-result-row";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";

const SEARCH_DEBOUNCE_MS = 250;

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
  const { watched, loaded, toggleTicker } = useWatchlist();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  const [highlight, setHighlight] = useState(0);

  const debouncedTrim = debounced.trim();
  const queryTrim = query.trim();

  const fullscreen = variant === "fullscreen";

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [debouncedTrim]);

  useEffect(() => {
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
    setHighlight((h) => Math.min(h, Math.max(0, next.length - 1)));
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
  }, [queryTrim, items, recent, highlight, navigateTo, onClose]);

  const showResults = queryTrim.length > 0;
  const emptyQuery = !showResults;
  const noRecent = emptyQuery && recent.length === 0;
  const showStaleList = showResults && items.length > 0;
  const noResults = showResults && !loading && items.length === 0;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col bg-white"
          : "fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh]"
      }
      onClick={fullscreen ? undefined : onClose}
      role="presentation"
    >
      <div
        className={
          fullscreen
            ? "flex min-h-0 w-full flex-1 flex-col"
            : "mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={fullscreen ? "Add company" : "Search"}
      >
        <div
          className={
            fullscreen
              ? "flex shrink-0 items-center gap-3 border-b border-[#E4E4E7] px-6 py-4 sm:px-9"
              : "flex items-center gap-3 border-b border-[#E4E4E7] px-5 py-3.5"
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

        <div className={fullscreen ? "min-h-0 flex-1 overflow-y-auto py-2" : "max-h-[420px] overflow-y-auto py-2"}>
          {emptyQuery ? (
            <>
              <div className="px-5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                Recent searches
              </div>
              {noRecent ? (
                <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">
                  No recent searches yet. Type to find assets — we will remember what you open here.
                </div>
              ) : (
                recent.map((item, i) => (
                  <SearchResultRow
                    key={item.id}
                    variant="recent"
                    item={item}
                    onNavigate={navigateTo}
                    onRemoveRecent={() => handleRemoveRecent(item.id)}
                    active={highlight === i}
                    starred={isWatchedItem(item, watched)}
                    loaded={loaded}
                    toggleTicker={toggleTicker}
                  />
                ))
              )}
            </>
          ) : loading && !showStaleList ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">Searching…</div>
          ) : noResults ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">
              No results for &ldquo;{queryTrim}&rdquo;
            </div>
          ) : (
            <>
              {loading && showStaleList ? (
                <div className="px-5 pb-1 text-center text-[11px] text-[#A1A1AA]" aria-hidden>
                  Updating…
                </div>
              ) : null}
              {items.map((item, i) => (
                <SearchResultRow
                  key={item.id}
                  variant="live"
                  item={item}
                  onNavigate={navigateTo}
                  active={highlight === i}
                  starred={isWatchedItem(item, watched)}
                  loaded={loaded}
                  toggleTicker={toggleTicker}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dispatched globally so any UI (e.g. stock bottom bar) can open the same modal as the top bar. */
export const OPEN_SEARCH_EVENT = "finsepa-open-search";

export function requestOpenSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
