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
        type="search"
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

export function MobileBottomNavSearchResults({
  open,
  panel,
  barRef,
  searchMorphRef,
}: {
  open: boolean;
  panel: SearchPanel;
  barRef: React.RefObject<HTMLElement | null>;
  searchMorphRef: React.RefObject<HTMLElement | null>;
}) {
  const [anchor, setAnchor] = useState({ left: 0, width: 0, bottom: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const bar = barRef.current;
      const morph = searchMorphRef.current;
      if (!bar) return;
      const barRect = bar.getBoundingClientRect();
      const morphRect = morph?.getBoundingClientRect();
      setAnchor({
        left: morphRect?.left ?? barRect.left,
        width: morphRect?.width ?? barRect.width,
        bottom: window.innerHeight - barRect.top + 8,
      });
    };

    measure();
    const morph = searchMorphRef.current;
    const ro = morph ? new ResizeObserver(measure) : null;
    ro?.observe(morph!);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, barRef, searchMorphRef, panel.query]);

  if (!open) return null;

  return (
    <div
      id="mobile-bottom-search-results"
      className={cn(
        dropdownMenuSurfaceClassName("fixed z-[42] overflow-hidden md:hidden"),
        dropdownMenuFloatingScrollbarClassName,
      )}
      style={{
        left: anchor.left,
        width: anchor.width,
        bottom: anchor.bottom,
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
        toggleTicker={panel.toggleTicker}
        listClassName="max-h-[min(420px,52dvh)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      />
    </div>
  );
}
