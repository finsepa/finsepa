"use client";

import { Star } from "@/lib/icons";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { useSuperinvestorFollow } from "@/lib/superinvestors/use-superinvestor-follow";

type Props = {
  profileHref: string;
  label: string;
  className?: string;
  buttonClassName?: string;
};

/**
 * Screener-style star for superinvestor profiles — toggles Following list (localStorage today).
 */
export function SuperinvestorFollowStarToggle({
  profileHref,
  label,
  className,
  buttonClassName = "",
}: Props) {
  const { hydrated, isFollowing, toggleFollow } = useSuperinvestorFollow();
  const starred = hydrated && isFollowing(profileHref);
  const tooltipLabel = starred ? "Unfollow" : "Follow";

  return (
    <TopbarDelayedTooltip label={tooltipLabel} className={className}>
      <button
        type="button"
        aria-label={starred ? `Unfollow ${label}` : `Follow ${label}`}
        aria-pressed={starred}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFollow(profileHref, { displayName: label });
        }}
        className={`-m-1 flex h-7 w-7 items-center justify-center rounded-full text-fg outline-none transition-colors duration-100 hover:bg-dropdown-item-hover focus-visible:ring-2 focus-visible:ring-fg/20 ${buttonClassName}`}
      >
        <Star
          className={`h-4 w-4 transition-colors ${
            starred
              ? "fill-orange text-orange"
              : "fill-none text-neutral-300 group-hover:text-neutral-400"
          }`}
        />
      </button>
    </TopbarDelayedTooltip>
  );
}
