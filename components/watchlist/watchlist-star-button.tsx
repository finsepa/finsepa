"use client";

import { Star } from "lucide-react";

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
  /** `detail` = premium header control (asset pages). `default` = screener / tables. */
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
            ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-50/90 focus-visible:ring-2 focus-visible:ring-neutral-900/10 ${buttonClassName}`
            : `flex items-center justify-center rounded-md p-0.5 text-[#09090B] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/20 ${buttonClassName}`
        }
      >
        <Star
          className={
            isDetail
              ? `h-[18px] w-[18px] transition-colors ${
                  isWatched
                    ? "fill-amber-500 text-amber-500"
                    : "fill-none text-neutral-400 stroke-[1.5] stroke-current"
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
