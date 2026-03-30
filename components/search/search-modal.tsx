"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import type { SearchAssetItem } from "@/lib/search/search-types";
import type { SearchScope } from "@/lib/search/search-types";
import { readRecentSearches, recordSearchNavigation, removeRecentSearchById } from "@/lib/search/recent-searches-storage";
import { SearchResultRow } from "@/components/search/search-result-row";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

const TABS: { id: SearchScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "indices", label: "Indices" },
];

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { watched, loaded, toggleTicker } = useWatchlist();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 220);
  const [scope, setScope] = useState<SearchScope>("all");
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query, scope, items, recent]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(scope)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { items?: SearchAssetItem[] };
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, scope]);

  const navigateTo = useCallback(
    (item: SearchAssetItem) => {
      recordSearchNavigation(item);
      setRecent(readRecentSearches());
      router.push(item.route);
      onClose();
    },
    [onClose, router],
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
      const list = query.trim().length > 0 ? items : recent;
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
  }, [query, items, recent, highlight, navigateTo, onClose]);

  const showResults = query.trim().length > 0;
  const emptyQuery = !showResults;
  const noRecent = emptyQuery && recent.length === 0;
  const noResults = showResults && !loading && items.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-[#71717A]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks, crypto, indices…"
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

        <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E4E4E7] px-5 py-3 scrollbar-none">
          {TABS.map((t) => {
            const active = scope === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setScope(t.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-[#2563EB] bg-white text-[#2563EB]"
                    : "border-[#E4E4E7] bg-white text-[#09090B] hover:bg-[#F4F4F5]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
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
                    watched={watched}
                    loaded={loaded}
                    toggleTicker={toggleTicker}
                  />
                ))
              )}
            </>
          ) : loading ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">Searching…</div>
          ) : noResults ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">
              No results for &ldquo;{query.trim()}&rdquo;
            </div>
          ) : (
            items.map((item, i) => (
              <SearchResultRow
                key={item.id}
                variant="live"
                item={item}
                onNavigate={navigateTo}
                active={highlight === i}
                watched={watched}
                loaded={loaded}
                toggleTicker={toggleTicker}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
