"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Trash2 } from "@/lib/icons";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import type { WatchlistCollection } from "@/lib/watchlist/collections";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

const watchlistRowRemoveButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#DC2626] focus-visible:bg-[#F4F4F5] focus-visible:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2";

type ToggleProps = {
  /** Stored watchlist key (plain ticker, CRYPTO:BTC, INDEX:GSPC.INDX, …). */
  storageKey: string;
  /** Shown in aria-label (e.g. ticker or asset name). */
  label: string;
  watched: Set<string>;
  loaded: boolean;
  storageHydrated?: boolean;
  toggleTicker: (ticker: string, watchlistId?: string) => void;
  watchlists?: WatchlistCollection[];
  /** Active watchlist — star click adds here when not already saved. */
  activeWatchlistId?: string;
  /** Outer wrapper, e.g. `flex w-10 shrink-0 items-center justify-center px-3` */
  className?: string;
  /** Extra classes on the button. */
  buttonClassName?: string;
  /** `detail` = asset page header — matches top bar icon buttons. `default` = screener / tables. */
  variant?: "default" | "detail";
};

function WatchlistPickerDropdown({
  open,
  anchorRef,
  watchlists,
  onSelect,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  watchlists: WatchlistCollection[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, onClose]);

  return (
    <TopbarDropdownPortal open={open} anchorRef={anchorRef} align="trailing">
      <div ref={menuRef} className={dropdownMenuPanelClassName("w-[200px]")} role="menu">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
          Add to watchlist
        </p>
        {watchlists.map((list) => (
          <button
            key={list.id}
            type="button"
            role="menuitem"
            className={dropdownMenuPlainItemClassName()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(list.id);
              onClose();
            }}
          >
            {list.name}
          </button>
        ))}
      </div>
    </TopbarDropdownPortal>
  );
}

/**
 * Presentational toggle — use with a single parent `useWatchlist()` (e.g. screener table rows).
 * SSR renders a static placeholder so server/client markup always matches.
 */
export function WatchlistStarToggle(props: ToggleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={props.className} aria-hidden>
        <span className="inline-flex h-4 w-4 shrink-0" />
      </div>
    );
  }

  return <WatchlistStarToggleInteractive {...props} />;
}

function WatchlistStarToggleInteractive({
  storageKey,
  label,
  watched,
  loaded,
  storageHydrated = false,
  toggleTicker,
  watchlists = [],
  activeWatchlistId,
  className,
  buttonClassName = "",
  variant = "default",
}: ToggleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isWatched = loaded && isWatchlistTickerWatched(watched, storageKey);
  const isDetail = variant === "detail";
  const showListPicker = storageHydrated && !isWatched && watchlists.length > 1;
  const activeId =
    watchlists.find((list) => list.id === activeWatchlistId)?.id ?? watchlists[0]?.id;
  const canAdd =
    loaded && storageHydrated && Boolean(activeId) && activeId !== "pending";
  const canRemove = loaded && isWatched;

  const tooltipLabel = isWatched ? "Remove from Watchlist" : "Add to Watchlist";

  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWatched) {
      if (!canRemove) return;
      toggleTicker(storageKey);
      return;
    }
    if (!canAdd) return;
    if (showListPicker) {
      setPickerOpen((prev) => !prev);
      return;
    }
    if (!activeId) return;
    toggleTicker(storageKey, activeId);
  };

  return (
    <div className={className}>
      <TopbarDelayedTooltip label={tooltipLabel}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={isWatched ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
          aria-pressed={isWatched}
          aria-haspopup={showListPicker ? "menu" : undefined}
          aria-expanded={showListPicker && pickerOpen ? true : undefined}
          onClick={handleStarClick}
          className={
            isDetail
              ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] outline-none transition-all duration-100 hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-neutral-900/10 ${buttonClassName}`
              : `flex items-center justify-center rounded-md p-0.5 text-[#0F0F0F] outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/20 ${buttonClassName}`
          }
        >
          <Star
            className={
              isDetail
                ? `h-5 w-5 shrink-0 transition-colors ${
                    isWatched
                      ? "fill-amber-500 text-amber-500"
                      : "fill-none text-[#0F0F0F]"
                  }`
                : `h-4 w-4 transition-colors ${
                    isWatched
                      ? "fill-orange-400 text-orange-400"
                      : "fill-none text-neutral-300 group-hover:text-neutral-400"
                  }`
            }
          />
        </button>
      </TopbarDelayedTooltip>
      {showListPicker ? (
        <WatchlistPickerDropdown
          open={pickerOpen}
          anchorRef={buttonRef}
          watchlists={watchlists}
          onSelect={(id) => toggleTicker(storageKey, id)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

type ButtonProps = Omit<ToggleProps, "watched" | "loaded" | "toggleTicker" | "watchlists">;

/**
 * Self-contained toggle for asset headers (single star per section).
 */
export function WatchlistStarButton(props: ButtonProps) {
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();
  return (
    <WatchlistStarToggle
      {...props}
      watched={watchedUnion}
      loaded={loaded}
      storageHydrated={storageHydrated}
      toggleTicker={toggleTicker}
      watchlists={watchlists}
      activeWatchlistId={activeWatchlistId}
    />
  );
}

/** Watchlist table: remove row from the active watchlist only. */
export function WatchlistRowRemoveButton({
  storageKey,
  label,
  onRemove,
  className,
}: {
  storageKey: string;
  label: string;
  onRemove: (ticker: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        aria-label={`Remove ${label} from watchlist`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(storageKey);
        }}
        className={cn(watchlistRowRemoveButtonClass)}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
