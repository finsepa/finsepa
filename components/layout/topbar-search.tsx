"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { OPEN_SEARCH_EVENT } from "@/components/search/search-modal";
import { SearchPanelResults } from "@/components/search/search-panel-results";
import { useSearchPanel } from "@/components/search/use-search-panel";
import { cn } from "@/lib/utils";

const SEARCH_PANEL_WIDTH_CLASS = "w-[360px] max-w-[calc(100vw-2rem)]";

export function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const openSearch = useCallback(() => setOpen(true), []);

  const panel = useSearchPanel({ open, onClose: close });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true], [role=textbox]")) return;
      e.preventDefault();
      openSearch();
    }
    function onOpenSearch() {
      openSearch();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    };
  }, [openSearch]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => document.removeEventListener("mousedown", onPointerDown, true);
  }, [open, close]);

  const searchControl = (
    <div className={cn("relative w-full", SEARCH_PANEL_WIDTH_CLASS, open && "z-[45]")}>
      <div
        ref={anchorRef}
        role="search"
        className={cn(
          "flex h-9 min-w-0 items-center gap-2 rounded-lg px-4 transition-colors duration-150 ease-out",
          open ?
            "bg-white ring-1 ring-[#E4E4E7] ring-inset"
          : "cursor-text bg-[#F4F4F5] hover:bg-[#EBEBEB]",
        )}
        onClick={!open ? openSearch : undefined}
      >
        <Search className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
        {open ? (
          <input
            ref={panel.inputRef}
            type="search"
            value={panel.query}
            onChange={(e) => panel.setQuery(e.target.value)}
            placeholder="Search Apple, NVIDIA, Bitcoin, Ethereum, S&P 500…"
            className="min-w-0 flex-1 bg-transparent text-base leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA] md:text-sm"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
            aria-label="Search"
            aria-expanded={open}
            aria-controls="topbar-search-results"
            aria-autocomplete="list"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-left text-sm leading-5 text-[#A1A1AA]">Search...</span>
        )}
        {open ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            aria-label="Close search"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <kbd
            className="pointer-events-none hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA] md:inline-flex"
            aria-hidden
          >
            S
          </kbd>
        )}
      </div>

      <TopbarDropdownPortal open={open} anchorRef={anchorRef} align="leading">
        <div
          ref={dropdownRef}
          id="topbar-search-results"
          className={cn(
            dropdownMenuSurfaceClassName(
              "origin-top overflow-hidden shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.12),0px_4px_6px_0px_rgba(10,10,10,0.06)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200",
            ),
            SEARCH_PANEL_WIDTH_CLASS,
          )}
          role="listbox"
          aria-label="Search results"
        >
          <SearchPanelResults
            emptyQuery={panel.emptyQuery}
            noRecent={panel.noRecent}
            recent={panel.recent}
            queryTrim={panel.queryTrim}
            loading={panel.loading}
            showStaleList={panel.showStaleList}
            noResults={panel.noResults}
            items={panel.items}
            highlight={panel.highlight}
            onNavigate={panel.navigateTo}
            onRemoveRecent={panel.handleRemoveRecent}
            isWatched={panel.isWatched}
            watchlistLoaded={panel.watchlistLoaded}
            toggleTicker={panel.toggleTicker}
            listClassName="max-h-[min(420px,60dvh)] overflow-y-auto overscroll-y-contain py-2 [-webkit-overflow-scrolling:touch]"
            sectionClassName="px-4"
          />
        </div>
      </TopbarDropdownPortal>
    </div>
  );

  if (open) return searchControl;
  return <TopbarDelayedTooltip label="Search">{searchControl}</TopbarDelayedTooltip>;
}
