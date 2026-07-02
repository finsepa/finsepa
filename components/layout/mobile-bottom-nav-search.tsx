"use client";

import { useLayoutEffect, useState } from "react";

import {
  dropdownMenuFloatingScrollbarClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { SearchPanelResults } from "@/components/search/search-panel-results";
import type { useSearchPanel } from "@/components/search/use-search-panel";
import { cn } from "@/lib/utils";

type SearchPanel = ReturnType<typeof useSearchPanel>;

export function MobileBottomNavSearchField({
  panel,
  className,
  resultsVisible = false,
}: {
  panel: SearchPanel;
  className?: string;
  resultsVisible?: boolean;
}) {
  return (
    <div className={cn("flex h-full min-w-0 flex-1 items-center px-4", className)}>
      <input
        ref={panel.inputRef}
        data-mobile-bottom-search-input
        type="text"
        inputMode="search"
        value={panel.query}
        onChange={(e) => panel.setQuery(e.target.value)}
        placeholder="Search..."
        className="h-full w-full min-w-0 bg-transparent text-sm leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA] caret-[#09090B]"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="search"
        role="searchbox"
        aria-label="Search"
        aria-controls="mobile-bottom-search-results"
        aria-expanded={resultsVisible}
        aria-autocomplete="list"
      />
    </div>
  );
}

/** Fixed results sheet anchored above the morphing search pill (tracks visual viewport + keyboard). */
export function MobileBottomNavSearchResults({
  open,
  panel,
  searchMorphRef,
}: {
  open: boolean;
  panel: SearchPanel;
  searchMorphRef: React.RefObject<HTMLElement | null>;
}) {
  const [anchor, setAnchor] = useState({ left: 0, width: 0, bottom: 0, maxHeight: 420 });

  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const morph = searchMorphRef.current;
      if (!morph) return;
      const morphRect = morph.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportTop = vv?.offsetTop ?? 0;
      const gap = 8;
      const topInset = 12;
      setAnchor({
        left: morphRect.left,
        width: morphRect.width,
        bottom: window.innerHeight - morphRect.top + gap,
        maxHeight: Math.max(160, morphRect.top - viewportTop - topInset),
      });
    };

    measure();
    const morph = searchMorphRef.current;
    if (!morph) return;
    const ro = new ResizeObserver(measure);
    ro.observe(morph);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [open, searchMorphRef, panel.query]);

  if (!open) return null;

  return (
    <div
      id="mobile-bottom-search-results"
      className={cn(
        "mobile-bottom-nav-search-results-panel fixed z-[42] flex min-h-0 flex-col overflow-hidden md:hidden",
        dropdownMenuSurfaceClassName(),
        dropdownMenuFloatingScrollbarClassName,
      )}
      style={{
        left: anchor.left,
        width: anchor.width,
        bottom: anchor.bottom,
        maxHeight: anchor.maxHeight,
      }}
      role="listbox"
      aria-label="Search results"
    >
      <SearchPanelResults
        emptyQuery={panel.emptyQuery}
        noRecent={panel.noRecent}
        recent={panel.recent}
        queryTrim={panel.queryTrim}
        loading={panel.loading}
        searchPending={panel.searchPending}
        showStaleList={panel.showStaleList}
        noResults={panel.noResults}
        items={panel.items}
        highlight={panel.highlight}
        onNavigate={panel.navigateTo}
        onRemoveRecent={panel.handleRemoveRecent}
        isWatched={panel.isWatched}
        watchlistLoaded={panel.watchlistLoaded}
        watchlistStorageHydrated={panel.watchlistStorageHydrated}
        toggleTicker={panel.toggleTicker}
        watchlists={panel.watchlists}
        activeWatchlistId={panel.activeWatchlistId}
        watched={panel.watched}
        listClassName="mobile-bottom-nav-search-results-list min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      />
    </div>
  );
}
