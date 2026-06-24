"use client";

import { BellMinus, BellPlus } from "@/lib/icons";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { isWatchlistTickerWatched } from "@/lib/watchlist/normalize-storage-key";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

type ToggleProps = {
  /** Stored watchlist key (plain ticker, CRYPTO:BTC, INDEX:GSPC.INDX, …). */
  storageKey: string;
  /** Shown in aria-label (e.g. ticker or asset name). */
  label: string;
  watched: Set<string>;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
  className?: string;
  buttonClassName?: string;
  /** `detail` = grey header control (modals / asset pages). `default` = compact tables. */
  variant?: "default" | "detail";
};

export function WatchlistBellToggle({
  storageKey,
  label,
  watched,
  loaded,
  toggleTicker,
  className,
  buttonClassName = "",
  variant = "default",
}: ToggleProps) {
  const isWatched = loaded && isWatchlistTickerWatched(watched, storageKey);
  const isDetail = variant === "detail";
  const tooltipLabel = isWatched ? "Remove from Watchlist" : "Add to Watchlist";
  const Icon = isWatched ? BellMinus : BellPlus;

  return (
    <TopbarDelayedTooltip
      label={tooltipLabel}
      className={className}
      placement={isDetail ? "left" : "bottom"}
      zIndex={isDetail ? 350 : undefined}
    >
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
            ? `flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5] text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/15 ${buttonClassName}`
            : `flex items-center justify-center rounded-md p-0.5 text-[#09090B] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/20 ${buttonClassName}`
        }
      >
        <Icon className={isDetail ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} strokeWidth={2} aria-hidden />
      </button>
    </TopbarDelayedTooltip>
  );
}

type ButtonProps = Omit<ToggleProps, "watched" | "loaded" | "toggleTicker">;

/** Self-contained watchlist bell toggle (toast alerts via {@link useWatchlist}). */
export function WatchlistBellButton(props: ButtonProps) {
  const { watchedUnion, loaded, toggleTicker } = useWatchlist();
  return (
    <WatchlistBellToggle {...props} watched={watchedUnion} loaded={loaded} toggleTicker={toggleTicker} />
  );
}
