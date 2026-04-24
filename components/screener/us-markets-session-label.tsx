"use client";

import { useMemo } from "react";

import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { getUsMarketsHeaderStatus } from "@/lib/market/us-equity-market-session";
import { cn } from "@/lib/utils";

/**
 * Markets header line — matches `UsEquityMarketSessionBadge` session visuals
 * (pre/post SVG badges, green dot when live, gray dot when closed).
 * Snapshot at mount / full page load (no interval refresh).
 */
export function UsMarketsSessionLabel({ className }: { className?: string }) {
  const status = useMemo(() => getUsMarketsHeaderStatus(new Date()), []);

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 text-[13px] font-medium leading-5 text-[#71717A]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {status.variant === "pre" ? (
        <>
          <PreMarketEarningsIcon size={20} />
          <span className="min-w-0">
            U.S Markets open in {status.countdownText}
          </span>
        </>
      ) : null}
      {status.variant === "live" ? (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#16A34A]" aria-hidden />
          <span>U.S Markets live</span>
        </>
      ) : null}
      {status.variant === "post" ? (
        <>
          <PostMarketEarningsIcon size={24} />
          <span>U.S Markets post market</span>
        </>
      ) : null}
      {status.variant === "closed" ? (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#71717A]" aria-hidden />
          <span>U.S Markets market closed</span>
        </>
      ) : null}
    </div>
  );
}
