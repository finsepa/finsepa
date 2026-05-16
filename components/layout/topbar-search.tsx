"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { OPEN_SEARCH_EVENT } from "@/components/search/search-modal";
import { SearchPanelResults } from "@/components/search/search-panel-results";
import { useSearchPanel } from "@/components/search/use-search-panel";
import { cn } from "@/lib/utils";

const SEARCH_PANEL_WIDTH_CLASS = "w-[360px] max-w-[calc(100vw-2rem)]";

/** Above page content, below topbar (`z-30`) and search dropdown (`z-220`). */
const SEARCH_DISMISS_BACKDROP_Z = 29;

export function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
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
    setPortalMounted(true);
  }, []);

  const searchControl = (
    <div className={cn("relative w-full", SEARCH_PANEL_WIDTH_CLASS, open && "z-[45]")}>
      <div
        ref={anchorRef}
        role="search"
        className={cn(
          "flex h-9 min-w-0 cursor-text items-center gap-2 rounded-lg bg-[#F4F4F5] px-4",
          !open && "hover:bg-[#EBEBEB]",
        )}
        onClick={!open ? openSearch : undefined}
      >
        <Search className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
        <input
          ref={panel.inputRef}
          type="text"
          inputMode="search"
          readOnly={!open}
          value={panel.query}
          onChange={(e) => panel.setQuery(e.target.value)}
          placeholder="Search..."
          className="min-w-0 flex-1 cursor-text bg-transparent text-sm leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA] caret-[#09090B] read-only:cursor-text"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
          role="searchbox"
          aria-label="Search"
          aria-expanded={open}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
        />
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
          className={cn(dropdownMenuSurfaceClassName("overflow-hidden"), SEARCH_PANEL_WIDTH_CLASS)}
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
            listClassName={cn(
              dropdownMenuPanelBodyClassName,
              "max-h-[min(420px,60dvh)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
            )}
            sectionClassName="px-3 pb-1 pt-1"
          />
        </div>
      </TopbarDropdownPortal>
    </div>
  );

  const dismissBackdrop =
    open && portalMounted
      ? createPortal(
          <div
            className="fixed inset-0 cursor-default bg-transparent"
            style={{ zIndex: SEARCH_DISMISS_BACKDROP_Z }}
            aria-hidden
            onPointerDown={(e) => {
              e.preventDefault();
              close();
            }}
          />,
          document.body,
        )
      : null;

  return (
    <>
      {dismissBackdrop}
      <TopbarDelayedTooltip label="Search" enabled={!open}>
        {searchControl}
      </TopbarDelayedTooltip>
    </>
  );
}
