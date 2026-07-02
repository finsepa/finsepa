"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SearchPanelResults } from "@/components/search/search-panel-results";
import type { useSearchPanel } from "@/components/search/use-search-panel";
import { useMobileVisualViewport } from "@/lib/layout/use-mobile-visual-viewport";
import { Search, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

type SearchPanel = ReturnType<typeof useSearchPanel>;

/** Synced with `.mobile-bottom-nav-sheet-enter` in `globals.css`. */
export const MOBILE_SEARCH_SHEET_ENTER_MS = 320;
/** Delay after the sheet lands before focusing input + showing recents. */
export const MOBILE_SEARCH_KEYBOARD_DELAY_MS = 160;

const SHEET_TRANSITION = {
  duration: MOBILE_SEARCH_SHEET_ENTER_MS / 1000,
  ease: [0.32, 0.72, 0, 1] as const,
};

export function MobileBottomNavSearchSheet({
  open,
  interactive,
  panel,
  onClose,
}: {
  open: boolean;
  /** After sheet enter + short delay — enables focus, keyboard, and results list. */
  interactive: boolean;
  panel: SearchPanel;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const visualViewport = useMobileVisualViewport(open && interactive);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  const sheetHeightPx =
    interactive && visualViewport.heightPx > 0 ? visualViewport.heightPx : undefined;

  return createPortal(
    <AnimatePresence>
      {open ?
        <motion.div
          key="mobile-search-sheet-root"
          className="fixed inset-0 z-[50] md:hidden"
          role="presentation"
          initial={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className={cn(
              "mobile-bottom-nav-search-sheet absolute inset-x-0 bottom-0 flex min-h-0 flex-col overflow-hidden rounded-t-[20px] bg-white",
              "shadow-[0_-8px_30px_rgba(10,10,10,0.12)]",
            )}
            style={
              sheetHeightPx ?
                { height: sheetHeightPx }
              : { height: "min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 12px))" }
            }
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SHEET_TRANSITION}
          >
            <MobileBottomNavSearchSheetHeader onClose={onClose} />

            <div className="relative flex min-h-0 flex-1 flex-col">
              <AnimatePresence>
                {interactive ?
                  <motion.div
                    key="search-results"
                    id="mobile-bottom-search-results"
                    className="min-h-0 flex-1 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
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
                      listClassName="mobile-bottom-nav-search-results-list min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pb-2"
                    />
                  </motion.div>
                : <div key="search-spacer" className="min-h-0 flex-1" aria-hidden />}
              </AnimatePresence>

              <MobileBottomNavSearchInputBar
                panel={panel}
                interactive={interactive}
                resultsVisible={interactive}
                onClose={onClose}
              />
            </div>
          </motion.div>
        </motion.div>
      : null}
    </AnimatePresence>,
    document.body,
  );
}

function MobileBottomNavSearchSheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="shrink-0 touch-none"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.35 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 72 || info.velocity.y > 500) onClose();
      }}
    >
      <button
        type="button"
        className="flex w-full flex-col items-center px-4 pb-1 pt-2"
        aria-label="Close search"
        onClick={onClose}
      >
        <span className="mb-2 h-1 w-10 rounded-full bg-[#D4D4D8]" aria-hidden />
        <span className="text-[16px] font-semibold leading-6 text-[#09090B]">Search</span>
      </button>
    </motion.div>
  );
}

function MobileBottomNavSearchInputBar({
  panel,
  interactive,
  resultsVisible,
  onClose,
}: {
  panel: SearchPanel;
  interactive: boolean;
  resultsVisible: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "mobile-bottom-nav-search-input-bar sticky bottom-0 z-[2] shrink-0 bg-white px-3",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2",
        interactive && "shadow-[0_-4px_16px_rgba(10,10,10,0.06)]",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex h-11 min-w-0 flex-1 items-center rounded-full bg-[#F4F4F5] pl-11 pr-4">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71717A]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={panel.inputRef}
            data-mobile-bottom-search-input
            type="text"
            inputMode="search"
            readOnly={!interactive}
            tabIndex={interactive ? 0 : -1}
            value={panel.query}
            onChange={(e) => panel.setQuery(e.target.value)}
            placeholder="Search"
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-[16px] leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA]",
              interactive ? "caret-[#09090B]" : "caret-transparent",
            )}
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
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(9,9,11,0.06)] bg-white text-[#09090B] shadow-sm"
          aria-label="Close search"
          onClick={onClose}
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
