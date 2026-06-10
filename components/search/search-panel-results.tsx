"use client";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import { dropdownMenuPanelBodyClassName } from "@/components/design-system/dropdown-menu-styles";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
import { SearchRecentEmpty } from "@/components/search/search-recent-empty";
import { SearchResultRow } from "@/components/search/search-result-row";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { cn } from "@/lib/utils";

/** Section label inside {@link dropdownMenuPanelBodyClassName} — matches company/search pickers. */
export const searchDropdownSectionClassName =
  "px-2 pb-1 pt-0 text-[11px] font-semibold tracking-wide text-[#A1A1AA] uppercase";

const defaultListClassName =
  "max-h-[min(420px,60dvh)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]";

export function SearchPanelResults({
  emptyQuery,
  noRecent,
  recent,
  queryTrim,
  loading,
  searchPending,
  showStaleList,
  noResults,
  items,
  highlight,
  onNavigate,
  onRemoveRecent,
  isWatched,
  watchlistLoaded,
  toggleTicker,
  listClassName = defaultListClassName,
  sectionClassName = searchDropdownSectionClassName,
}: {
  emptyQuery: boolean;
  noRecent: boolean;
  recent: SearchAssetItem[];
  queryTrim: string;
  loading: boolean;
  searchPending: boolean;
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
  const showRecentList = emptyQuery && !noRecent;

  return (
    <DropdownScrollArea
      className={cn(dropdownMenuPanelBodyClassName, showRecentList && "pt-2", listClassName)}
    >
      {emptyQuery ? (
        <>
          {showRecentList ? <div className={sectionClassName}>Recent searches</div> : null}
          {noRecent ? (
            <SearchRecentEmpty />
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((item, i) => (
                <li key={item.id}>
                  <SearchResultRow
                    variant="recent"
                    item={item}
                    onNavigate={onNavigate}
                    onRemoveRecent={() => onRemoveRecent(item.id)}
                    active={highlight >= 0 && highlight === i}
                    starred={isWatched(item)}
                    loaded={watchlistLoaded}
                    toggleTicker={toggleTicker}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : searchPending && !showStaleList ? (
        <SearchLoadingIndicator />
      ) : noResults ? (
        <p className="px-2 py-8 text-center text-[12px] leading-5 text-[#71717A]">
          No results for &ldquo;{queryTrim}&rdquo;
        </p>
      ) : (
        <>
          {loading && showStaleList ? (
            <p className="px-2 pb-1 text-center text-[11px] text-[#A1A1AA]" aria-hidden>
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
                  active={highlight >= 0 && highlight === i}
                  starred={isWatched(item)}
                  loaded={watchlistLoaded}
                  toggleTicker={toggleTicker}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </DropdownScrollArea>
  );
}
