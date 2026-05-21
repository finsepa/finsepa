"use client";

import { dropdownMenuFloatingScrollClassName } from "@/components/design-system/dropdown-menu-styles";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
import { SearchResultRow } from "@/components/search/search-result-row";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { cn } from "@/lib/utils";

export function SearchPanelResults({
  emptyQuery,
  noRecent,
  recent,
  queryTrim,
  loading,
  showStaleList,
  noResults,
  items,
  highlight,
  onNavigate,
  onRemoveRecent,
  isWatched,
  watchlistLoaded,
  toggleTicker,
  listClassName = cn(
    dropdownMenuFloatingScrollClassName,
    "max-h-[min(420px,60dvh)] overflow-y-auto overscroll-y-contain",
  ),
  sectionClassName = "px-3 pb-1 pt-1",
}: {
  emptyQuery: boolean;
  noRecent: boolean;
  recent: SearchAssetItem[];
  queryTrim: string;
  loading: boolean;
  showStaleList: boolean;
  noResults: boolean;
  items: SearchAssetItem[];
  highlight: number;
  onNavigate: (item: SearchAssetItem) => void;
  onRemoveRecent: (id: string) => void;
  isWatched: (item: SearchAssetItem) => boolean;
  watchlistLoaded: boolean;
  toggleTicker: (ticker: string) => void;
  listClassName?: string;
  sectionClassName?: string;
}) {
  return (
    <div className={listClassName}>
      {emptyQuery ? (
        <>
          <div className={`${sectionClassName} text-[11px] font-semibold tracking-wide text-[#A1A1AA] uppercase`}>
            Recent searches
          </div>
          {noRecent ? (
            <p className={`${sectionClassName} py-8 text-center text-[12px] leading-5 text-[#71717A]`}>
              No recent searches yet. Type to find assets — we will remember what you open here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((item, i) => (
                <li key={item.id}>
                  <SearchResultRow
                    variant="recent"
                    item={item}
                    onNavigate={onNavigate}
                    onRemoveRecent={() => onRemoveRecent(item.id)}
                    active={highlight === i}
                    starred={isWatched(item)}
                    loaded={watchlistLoaded}
                    toggleTicker={toggleTicker}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : loading && !showStaleList ? (
        <SearchLoadingIndicator className={sectionClassName} />
      ) : noResults ? (
        <p className={`${sectionClassName} py-8 text-center text-[12px] leading-5 text-[#71717A]`}>
          No results for &ldquo;{queryTrim}&rdquo;
        </p>
      ) : (
        <>
          {loading && showStaleList ? (
            <p className={`${sectionClassName} pb-1 text-center text-[11px] text-[#A1A1AA]`} aria-hidden>
              Updating…
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {items.map((item, i) => (
              <li key={item.id}>
                <SearchResultRow
                  variant="live"
                  item={item}
                  onNavigate={onNavigate}
                  active={highlight === i}
                  starred={isWatched(item)}
                  loaded={watchlistLoaded}
                  toggleTicker={toggleTicker}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
