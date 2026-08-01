"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useSuperinvestorFollow } from "@/lib/superinvestors/use-superinvestor-follow";
import { cn } from "@/lib/utils";

export function SuperinvestorFollowButton({
  className,
  investorName,
}: {
  className?: string;
  /** Profile heading name for follow toast (e.g. Warren Buffett). */
  investorName?: string;
}) {
  const pathname = usePathname();
  const { hydrated, isFollowing, toggleFollow } = useSuperinvestorFollow();
  const following = hydrated && isFollowing(pathname);
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showFollowing = hydrated && following;
  const showRemoving = showFollowing && hovered;
  // Keep SSR + first client paint stable; follow state loads from storage after mount.
  const label = !hydrated
    ? "Follow"
    : showFollowing
      ? showRemoving
        ? "Removing"
        : "Following"
      : "Follow";

  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={() => toggleFollow(pathname, { displayName: investorName })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onBlur={() => setHovered(false)}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
        "disabled:cursor-wait disabled:opacity-60",
        showRemoving
          ? "border-stroke bg-surface text-down shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))] hover:bg-surface-muted"
          : showFollowing
            ? "border-stroke bg-surface text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))] hover:bg-surface-muted"
            : "border-fg bg-fg text-surface hover:bg-[#18181B] dark:hover:bg-surface-hover",
        className,
      )}
      {...(mounted && hydrated ? { "aria-pressed": following } : {})}
      aria-label={showRemoving ? "Remove from following" : undefined}
    >
      {label}
    </button>
  );
}
