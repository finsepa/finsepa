"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "@/lib/icons";

import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { OPEN_SEARCH_EVENT } from "@/components/search/search-modal";
import { SearchPanelResults } from "@/components/search/search-panel-results";
import { useSearchPanel } from "@/components/search/use-search-panel";
import { cn } from "@/lib/utils";

/** Full width in the top bar on mobile; fixed pill width on desktop. */
const SEARCH_PANEL_WIDTH_CLASS =
  "w-full min-w-0 max-w-full md:w-[360px] md:max-w-[calc(100vw-2rem)]";

/** Above page content, below topbar (`z-30`) and search dropdown (`z-220`). */
const SEARCH_DISMISS_BACKDROP_Z = 29;

const SEARCH_MOTION_MS = 280;
const SEARCH_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
const MOBILE_MAX_WIDTH_MQ = "(max-width: 767px)";

const SEARCH_ICON_SIZE_PX = 20;
const SEARCH_ICON_GAP_PX = 8;
/** Icon inset inside the pill when collapsed (`pl-4`). */
const SEARCH_ICON_INSET_PX = 16;
/** Room for icon + gap before placeholder text when collapsed (icon inset is on the shell). */
const SEARCH_INPUT_COLLAPSED_PL_PX =
  SEARCH_ICON_INSET_PX + SEARCH_ICON_SIZE_PX + SEARCH_ICON_GAP_PX;
/** Active: icon animates out — text aligns with shell `pl-4`. */
const SEARCH_INPUT_OPEN_PL_PX = SEARCH_ICON_INSET_PX;
/** Collapsed: reserve the trailing shortcut chip (`right-3` + 28px control). */
const SEARCH_SHORTCUT_RESERVE_PX = 44;

export function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const panel = useSearchPanel({ open, onClose: close });

  /** Focus in the same user gesture (pointerdown) so iOS Safari opens the keyboard. */
  const focusSearchInput = useCallback(() => {
    const input = panel.inputRef.current;
    if (!input) return;
    input.readOnly = false;
    input.focus({ preventScroll: true });
  }, [panel.inputRef]);

  const activateSearch = useCallback(() => {
    focusSearchInput();
    setOpen(true);
  }, [focusSearchInput]);

  const handleSearchShellPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-topbar-search-close]")) return;
      if (open) {
        focusSearchInput();
        return;
      }
      activateSearch();
    },
    [activateSearch, focusSearchInput, open],
  );

  useEffect(() => {
    function isForeignEditableField(target: HTMLElement | null): boolean {
      if (!target) return false;
      if (target.closest("[data-topbar-search-input]")) return false;
      return Boolean(
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=textbox], [role=searchbox]",
        ),
      );
    }

    function onKey(e: KeyboardEvent) {
      if (window.matchMedia(MOBILE_MAX_WIDTH_MQ).matches) return;
      if (e.code !== "KeyS") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

      const t = e.target as HTMLElement | null;
      const fromOurInput = Boolean(t?.closest("[data-topbar-search-input]"));

      if (open) {
        if (fromOurInput) return;
        e.preventDefault();
        focusSearchInput();
        return;
      }

      if (isForeignEditableField(t)) return;

      e.preventDefault();
      activateSearch();
    }

    function onOpenSearch() {
      if (window.matchMedia(MOBILE_MAX_WIDTH_MQ).matches) return;
      activateSearch();
    }

    window.addEventListener("keydown", onKey, true);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    };
  }, [activateSearch, focusSearchInput, open]);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  const motionStyle = {
    transitionDuration: `${SEARCH_MOTION_MS}ms`,
    transitionTimingFunction: SEARCH_MOTION_EASE,
  } as const;

  const searchControl = (
    <div className={cn("relative w-full", SEARCH_PANEL_WIDTH_CLASS, open && "z-[45]")}>
      <div
        ref={anchorRef}
        role="search"
        data-open={open ? "true" : "false"}
        className={cn(
          "relative flex h-9 min-w-0 w-full cursor-text items-center overflow-hidden rounded-lg bg-[#EDEDEF] pl-4 pr-3 md:bg-[#F4F4F5]",
          "transition-colors motion-reduce:transition-none",
          !open && "hover:bg-[#EBEBEB]",
        )}
        style={motionStyle}
        onPointerDown={handleSearchShellPointerDown}
      >
        <span
          className="pointer-events-none absolute top-1/2 z-10 flex h-5 w-5 items-center justify-center text-[#09090B] motion-reduce:transition-none"
          style={{
            left: SEARCH_ICON_INSET_PX,
            ...motionStyle,
            transitionProperty: "transform",
            transform: open
              ? `translate(calc(-${SEARCH_ICON_INSET_PX}px - 100% - ${SEARCH_ICON_GAP_PX}px), -50%)`
              : "translateY(-50%)",
          }}
          aria-hidden
        >
          <Search className="h-5 w-5" strokeWidth={2} />
        </span>

        <input
          ref={panel.inputRef}
          data-topbar-search-input
          type="text"
          inputMode="search"
          tabIndex={open ? 0 : -1}
          readOnly={!open}
          value={panel.query}
          onChange={(e) => panel.setQuery(e.target.value)}
          placeholder="Search..."
          className={cn(
            "absolute inset-0 z-[1] h-full w-full min-w-0 cursor-text bg-transparent text-sm leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA] caret-[#09090B] read-only:cursor-text transition-[padding] motion-reduce:transition-none",
            !open && "pointer-events-none",
          )}
          style={{
            ...motionStyle,
            paddingLeft: open ? SEARCH_INPUT_OPEN_PL_PX : SEARCH_INPUT_COLLAPSED_PL_PX,
            paddingRight: open ? 40 : SEARCH_SHORTCUT_RESERVE_PX,
            clipPath: open
              ? undefined
              : `inset(-1px ${SEARCH_SHORTCUT_RESERVE_PX}px -1px 0)`,
          }}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
          role="searchbox"
          aria-label="Search"
          aria-expanded={open}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
        />

        {!open ? (
          <div
            className="absolute inset-0 z-[2] cursor-text"
            aria-hidden
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              activateSearch();
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute right-3 top-1/2 z-[3] flex h-7 w-7 -translate-y-1/2 items-center justify-center">
          <button
            type="button"
            data-topbar-search-close
            tabIndex={open ? 0 : -1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className={cn(
              "pointer-events-auto absolute inset-0 flex items-center justify-center rounded-md text-[#71717A]",
              "transition-opacity motion-reduce:transition-none",
              "hover:bg-[#EBEBEB] hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10",
              open ? "opacity-100" : "opacity-0",
            )}
            style={motionStyle}
            aria-label="Close search"
            aria-hidden={!open}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <kbd
            className={cn(
              "hidden rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA] md:inline-flex",
              "transition-opacity motion-reduce:transition-none",
              open ? "opacity-0" : "opacity-100",
            )}
            style={motionStyle}
            aria-hidden={open}
          >
            S
          </kbd>
        </div>
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
      <TopbarDelayedTooltip label="Search" enabled={!open} className="flex min-w-0 w-full">
        {searchControl}
      </TopbarDelayedTooltip>
    </>
  );
}
