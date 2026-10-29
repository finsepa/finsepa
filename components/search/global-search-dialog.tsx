"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Coins, Layers2, LineChart, PieChart, Search, UserRound } from "@/lib/icons";

import { SegmentedControl } from "@/components/design-system";
import { OverlayScrollArea } from "@/components/design-system/overlay-scroll-area";
import { textInputShellClassName } from "@/components/design-system/text-input-styles";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
import {
  SearchResultLeadingToggle,
  SearchResultLogo,
  searchResultCategoryLabel,
} from "@/components/search/search-result-row";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { seedPendingAssetShellFromSearchItem } from "@/lib/navigation/seed-pending-asset-shell-from-search";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { fetchSearchItems } from "@/lib/search/fetch-search-items";
import type { SearchDirectoryRow } from "@/lib/search/search-directory-types";
import { getSearchPanelViewState, SEARCH_CLIENT_DEBOUNCE_MS } from "@/lib/search/search-policy";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { useSearchDirectory } from "@/lib/search/use-search-directory";
import { useSearchRecentStorage } from "@/lib/search/use-search-recent-storage";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

type Category = "all" | "stocks" | "etfs" | "crypto" | "indices" | "superinvestors";
type ListTab = "all" | "watchlist";

const CATEGORIES: { id: Category; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All markets", Icon: Layers2 },
  { id: "stocks", label: "Stocks", Icon: LineChart },
  { id: "etfs", label: "ETFs", Icon: PieChart },
  { id: "crypto", label: "Crypto", Icon: Coins },
  { id: "indices", label: "Indices", Icon: BarChart3 },
  { id: "superinvestors", label: "Superinvestors", Icon: UserRound },
];

const SECTION_TITLE: Record<Exclude<Category, "all">, string> = {
  stocks: "Stocks",
  etfs: "ETFs",
  crypto: "Crypto",
  indices: "Indices",
  superinvestors: "Superinvestors",
};

/** "All markets" browse: short previews per category so the first paint stays light. */
const ALL_MARKETS_PREVIEW: Record<Exclude<Category, "all">, number> = {
  stocks: 10,
  etfs: 6,
  crypto: 10,
  indices: 10,
  superinvestors: 5,
};
/** Single-category browse cap (stocks universe is ~500). */
const CATEGORY_BROWSE_CAP = 100;
const RECENT_PREVIEW = 5;

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_32px] items-center gap-x-3";

type Section = { id: string; title: string; items: SearchAssetItem[] };

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function itemCategory(item: SearchAssetItem): Exclude<Category, "all"> {
  if (item.type === "superinvestor") return "superinvestors";
  if (item.type === "crypto") return "crypto";
  if (item.type === "index") return "indices";
  return item.marketLabel?.trim().toUpperCase() === "ETF" ? "etfs" : "stocks";
}

function directoryRowToItem(row: SearchDirectoryRow): SearchAssetItem {
  const enc = encodeURIComponent(row.symbol);
  if (row.category === "crypto") {
    return {
      id: `crypto:${row.symbol}`,
      type: "crypto",
      symbol: row.symbol,
      name: row.name,
      subtitle: null,
      logoUrl: getCryptoLogoUrl(row.symbol),
      route: `/crypto/${enc}`,
      marketLabel: "Crypto",
    };
  }
  if (row.category === "index") {
    return {
      id: `index:${row.symbol}`,
      type: "index",
      symbol: row.symbol,
      name: row.name,
      subtitle: row.symbol,
      logoUrl: null,
      route: `/index/${enc}`,
      marketLabel: "Index",
    };
  }
  return {
    id: `stock:${row.symbol}`,
    type: "stock",
    symbol: row.symbol,
    name: row.name,
    subtitle: "US",
    logoUrl: resolveEquityLogoUrlFromTicker(row.symbol),
    route: `/stock/${enc}`,
    marketLabel: row.category === "etf" ? "ETF" : "US equity",
  };
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-stroke bg-surface-muted px-1 font-sans text-[11px] font-medium text-fg-muted">
      {children}
    </kbd>
  );
}

/**
 * Desktop global search — category rail, All/Watchlist, browse lists from the cron snapshot directory.
 * Queries hit the existing `/api/search` (same cache keys as before); categories filter client-side.
 */
export function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchGenRef = useRef(0);

  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } = useWatchlist();
  const { readRecent, recordRecent, removeRecent } = useSearchRecentStorage();
  const directory = useSearchDirectory(true);

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, SEARCH_CLIENT_DEBOUNCE_MS);
  const debouncedTrim = debounced.trim();
  const queryTrim = query.trim();
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchAssetItem[]>([]);
  const [category, setCategory] = useState<Category>("all");
  const [tab, setTab] = useState<ListTab>("all");
  const [highlight, setHighlight] = useState(-1);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    setRecent(readRecent());
  }, [readRecent]);

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
        if (gen === searchGenRef.current) setItems(next);
      } catch (e) {
        if (gen !== searchGenRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setItems([]);
      } finally {
        if (gen === searchGenRef.current) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [debouncedTrim]);

  const browseByCategory = useMemo(() => {
    const browse: Record<Exclude<Category, "all">, SearchAssetItem[]> = {
      stocks: [],
      etfs: [],
      crypto: [],
      indices: [],
      superinvestors: directory?.superinvestors ?? [],
    };
    for (const row of directory?.rows ?? []) {
      const item = directoryRowToItem(row);
      browse[itemCategory(item)].push(item);
    }
    return browse;
  }, [directory]);

  const isWatched = useCallback(
    (item: SearchAssetItem) => isWatchlistTickerWatched(watchedUnion, watchlistStorageKeyForSearchItem(item)),
    [watchedUnion],
  );

  const passesFilters = useCallback(
    (item: SearchAssetItem) =>
      (category === "all" || itemCategory(item) === category) && (tab === "all" || isWatched(item)),
    [category, tab, isWatched],
  );

  const sections = useMemo((): Section[] => {
    if (queryTrim.length > 0) {
      const grouped = new Map<Exclude<Category, "all">, SearchAssetItem[]>();
      for (const item of items) {
        if (!passesFilters(item)) continue;
        const c = itemCategory(item);
        const list = grouped.get(c);
        if (list) list.push(item);
        else grouped.set(c, [item]);
      }
      return [...grouped].map(([c, list]) => ({ id: c, title: SECTION_TITLE[c], items: list }));
    }

    const out: Section[] = [];
    const recentFiltered = recent.filter(passesFilters).slice(0, RECENT_PREVIEW);
    if (recentFiltered.length) out.push({ id: "recent", title: "Recent", items: recentFiltered });

    const cats = category === "all" ? (Object.keys(SECTION_TITLE) as Exclude<Category, "all">[]) : [category];
    for (const c of cats) {
      let list = browseByCategory[c];
      if (tab === "watchlist") list = list.filter(isWatched);
      else list = list.slice(0, category === "all" ? ALL_MARKETS_PREVIEW[c] : CATEGORY_BROWSE_CAP);
      if (list.length) out.push({ id: c, title: SECTION_TITLE[c], items: list });
    }
    return out;
  }, [queryTrim, items, recent, category, tab, browseByCategory, passesFilters, isWatched]);

  const flatRows = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setHighlight(-1);
  }, [debouncedTrim, category, tab]);

  useEffect(() => {
    if (highlight < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const navigateTo = useCallback(
    (item: SearchAssetItem) => {
      recordRecent(item);
      seedPendingAssetShellFromSearchItem(item);
      router.push(item.route);
      onClose();
    },
    [onClose, recordRecent, router],
  );

  const clearRecent = useCallback(() => {
    for (const r of readRecent()) removeRecent(r.id);
    setRecent(readRecent());
  }, [readRecent, removeRecent]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const i = CATEGORIES.findIndex((c) => c.id === category);
        const step = e.key === "ArrowDown" ? 1 : -1;
        setCategory(CATEGORIES[(i + step + CATEGORIES.length) % CATEGORIES.length]!.id);
        return;
      }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setTab((t) => (t === "all" ? "watchlist" : "all"));
        return;
      }
      if (flatRows.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, flatRows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, -1));
      } else if (e.key === "Enter") {
        const row = flatRows[highlight >= 0 ? highlight : 0];
        if (row && (highlight >= 0 || queryTrim.length > 0)) {
          e.preventDefault();
          navigateTo(row);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [category, flatRows, highlight, navigateTo, onClose, queryTrim]);

  const { searchPending, showStaleList } = getSearchPanelViewState({
    queryTrim,
    debouncedTrim,
    loading,
    resultCount: items.length,
  });
  const showSpinner =
    (queryTrim.length > 0 && searchPending && !showStaleList) || (queryTrim.length === 0 && !directory && sections.length === 0);

  let rowIndex = -1;

  return (
    <AppModalOverlay open onClose={onClose} zIndex={100} align="top">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="flex h-[min(640px,calc(100dvh-14vh))] w-[min(980px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stroke-subtle bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)]"
      >
        <nav className="hidden w-[208px] shrink-0 flex-col gap-0.5 border-r border-stroke-subtle p-3 md:flex" aria-label="Category">
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Category</p>
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] leading-5 transition-colors",
                category === id ? "bg-surface-muted font-medium text-fg" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-3 px-4 pt-4">
            <div className={cn("flex h-11 items-center gap-2.5 rounded-xl px-3", textInputShellClassName)}>
              <Search className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a ticker or name"
                className="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-fg outline-none placeholder:text-fg-subtle"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                role="combobox"
                aria-expanded
                aria-controls="global-search-results"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <SegmentedControl
                aria-label="Search list"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "all", label: "All" },
                  { value: "watchlist", label: "Watchlist" },
                ]}
              />
            </div>
          </div>

          <OverlayScrollArea className="min-h-0 flex-1" viewportClassName="flex-1 px-2 pb-3">
          <div ref={listRef} id="global-search-results" role="listbox" aria-label="Search results">
            {showSpinner ? (
              <SearchLoadingIndicator />
            ) : sections.length === 0 ? (
              <p className="px-3 py-10 text-center text-[13px] leading-5 text-fg-muted">
                {queryTrim.length > 0
                  ? `No results for “${queryTrim}”`
                  : tab === "watchlist"
                    ? "Nothing from your watchlist here yet"
                    : "Nothing to show"}
              </p>
            ) : (
              sections.map((section) => (
                <section key={section.id} className="pt-3 first:pt-1">
                  <div className="flex items-center justify-between px-3 pb-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{section.title}</h3>
                    {section.id === "recent" ? (
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="text-[11px] font-medium text-fg-subtle transition-colors hover:text-fg"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {section.items.map((item) => {
                    rowIndex += 1;
                    const i = rowIndex;
                    return (
                      <div
                        key={`${section.id}:${item.id}`}
                        role="option"
                        aria-selected={highlight === i}
                        data-row-index={i}
                        onMouseMove={() => setHighlight(i)}
                        onClick={() => navigateTo(item)}
                        className={cn(
                          ROW_GRID,
                          "h-[52px] cursor-pointer rounded-[10px] px-3 transition-colors",
                          highlight === i ? "bg-surface-muted" : "hover:bg-surface-muted",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <SearchResultLogo item={item} />
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-[14px] font-semibold leading-5 text-fg">
                                {item.type === "crypto" ? eodhdCryptoSpotTickerDisplay(item.symbol) : item.symbol}
                              </span>
                              <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-px text-[11px] font-medium leading-4 text-fg-muted">
                                {searchResultCategoryLabel(item)}
                              </span>
                            </div>
                            <div className="truncate text-[12px] leading-4 text-fg-muted">{item.name}</div>
                          </div>
                        </div>
                        <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
                          <SearchResultLeadingToggle
                            item={item}
                            label={item.symbol}
                            wlKey={watchlistStorageKeyForSearchItem(item)}
                            watched={watchedUnion}
                            loaded={loaded}
                            storageHydrated={storageHydrated}
                            toggleTicker={toggleTicker}
                            watchlists={watchlists}
                            activeWatchlistId={activeWatchlistId}
                          />
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>
          </OverlayScrollArea>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stroke-subtle px-4 py-2.5 text-[12px] leading-4 text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd> to open
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>tab</Kbd> All / Watchlist
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>⌥</Kbd>
              <Kbd>↑↓</Kbd> to change category
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>esc</Kbd> to close
            </span>
          </div>
        </div>
      </div>
    </AppModalOverlay>
  );
}
