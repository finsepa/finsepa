"use client";

import { Star, Trash2 } from "lucide-react";

import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

type ToggleProps = {
  /** Stored watchlist key (plain ticker, CRYPTO:BTC, INDEX:GSPC.INDX, …). */
  storageKey: string;
  /** Shown in aria-label (e.g. ticker or asset name). */
  label: string;
  watched: Set<string>;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
  /** Outer wrapper, e.g. `flex w-10 shrink-0 items-center justify-center px-3` */
  className?: string;
  /** Extra classes on the button. */
  buttonClassName?: string;
  /** `detail` = asset page header — matches top bar icon buttons. `default` = screener / tables. */
  variant?: "default" | "detail";
};

/**
 * Presentational toggle — use with a single parent `useWatchlist()` (e.g. screener table rows).
 */
export function WatchlistStarToggle({
  storageKey,
  label,
  watched,
  loaded,
  toggleTicker,
  className,
  buttonClassName = "",
  variant = "default",
}: ToggleProps) {
  const key = storageKey.trim().toUpperCase();
  const isWatched = loaded && watched.has(key);
  const isDetail = variant === "detail";

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={isWatched ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
        aria-pressed={isWatched}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleTicker(storageKey);
        }}
        className={
          isDetail
            ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] outline-none transition-all duration-100 hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-neutral-900/10 ${buttonClassName}`
            : `flex items-center justify-center rounded-md p-0.5 text-[#09090B] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/20 ${buttonClassName}`
        }
      >
        <Star
          className={
            isDetail
              ? `h-5 w-5 shrink-0 transition-colors ${
                  isWatched
                    ? "fill-amber-500 text-amber-500"
                    : "fill-none text-[#09090B]"
                }`
              : `h-4 w-4 transition-colors ${
                  isWatched
                    ? "fill-orange-400 text-orange-400"
                    : "fill-none text-neutral-300 group-hover:text-neutral-400"
                }`
          }
        />
      </button>
    </div>
  );
}

type ButtonProps = Omit<ToggleProps, "watched" | "loaded" | "toggleTicker">;

/**
 * Self-contained toggle for asset headers (single star per section).
 */
export function WatchlistStarButton(props: ButtonProps) {
  const { watched, loaded, toggleTicker } = useWatchlist();
  return <WatchlistStarToggle {...props} watched={watched} loaded={loaded} toggleTicker={toggleTicker} />;
}

/** Watchlist table: remove row (same toggle as star, different affordance). */
export function WatchlistRowRemoveButton({
  storageKey,
  label,
  toggleTicker,
  className,
}: {
  storageKey: string;
  label: string;
  toggleTicker: (ticker: string) => void;
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
          toggleTicker(storageKey);
        }}
        className="flex items-center justify-center rounded-md p-1.5 text-[#A1A1AA] outline-none transition-colors hover:text-red-600 focus-visible:ring-2 focus-visible:ring-[#09090B]/20"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
