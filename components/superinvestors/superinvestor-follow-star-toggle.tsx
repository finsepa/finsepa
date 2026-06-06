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
        className={`flex items-center justify-center rounded-md p-0.5 text-[#09090B] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/20 ${buttonClassName}`}
      >
        <Star
          className={`h-4 w-4 transition-colors ${
            starred
              ? "fill-orange-400 text-orange-400"
              : "fill-none text-neutral-300 group-hover:text-neutral-400"
          }`}
        />
      </button>
    </TopbarDelayedTooltip>
  );
}
