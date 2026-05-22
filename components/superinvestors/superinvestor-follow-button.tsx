"use client";

import { usePathname } from "next/navigation";

import { useSuperinvestorFollow } from "@/lib/superinvestors/use-superinvestor-follow";
import { cn } from "@/lib/utils";

export function SuperinvestorFollowButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const { hydrated, isFollowing, toggleFollow } = useSuperinvestorFollow();
  const following = hydrated && isFollowing(pathname);

  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={() => toggleFollow(pathname)}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
        "disabled:cursor-wait disabled:opacity-60",
        following
          ? "border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] hover:bg-[#F4F4F5]"
          : "border-[#09090B] bg-[#09090B] text-white hover:bg-[#18181B]",
        className,
      )}
      aria-pressed={following}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
