"use client";

import type { SearchAssetItem } from "@/lib/search/search-types";
import { SearchResultRow } from "@/components/search/search-result-row";

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
  listClassName = "max-h-[min(420px,60dvh)] overflow-y-auto py-2",
  sectionClassName = "px-5",
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
          <div className={`${sectionClassName} pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]`}>
            Recent searches
          </div>
          {noRecent ? (
            <p className={`${sectionClassName} py-10 text-center text-[14px] text-[#71717A]`}>
              No recent searches yet. Type to find assets — we will remember what you open here.
            </p>
          ) : (
            recent.map((item, i) => (
              <SearchResultRow
                key={item.id}
                variant="recent"
                item={item}
                onNavigate={onNavigate}
                onRemoveRecent={() => onRemoveRecent(item.id)}
                active={highlight === i}
                starred={isWatched(item)}
                loaded={watchlistLoaded}
                toggleTicker={toggleTicker}
              />
            ))
          )}
        </>
      ) : loading && !showStaleList ? (
        <p className={`${sectionClassName} py-10 text-center text-[14px] text-[#71717A]`}>Searching…</p>
      ) : noResults ? (
        <p className={`${sectionClassName} py-10 text-center text-[14px] text-[#71717A]`}>
          No results for &ldquo;{queryTrim}&rdquo;
        </p>
      ) : (
        <>
          {loading && showStaleList ? (
            <p className={`${sectionClassName} pb-1 text-center text-[11px] text-[#A1A1AA]`} aria-hidden>
              Updating…
            </p>
          ) : null}
          {items.map((item, i) => (
            <SearchResultRow
              key={item.id}
              variant="live"
              item={item}
              onNavigate={onNavigate}
              active={highlight === i}
              starred={isWatched(item)}
              loaded={watchlistLoaded}
              toggleTicker={toggleTicker}
            />
          ))}
        </>
      )}
    </div>
  );
}
