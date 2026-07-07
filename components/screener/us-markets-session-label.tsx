"use client";

import { useEffect, useState } from "react";

import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import {
  formatUsEquitySessionBadgeLabel,
  getUsEquitySessionBadgeDisplay,
  type UsEquitySessionBadgeDisplay,
} from "@/lib/market/us-equity-market-session";
import { cn } from "@/lib/utils";

const MARKET_OPEN_DOT_GREEN = "bg-[#16A34A]";

function MarketsSessionStatusIcon({ display }: { display: UsEquitySessionBadgeDisplay }) {
  switch (display.kind) {
    case "pre":
      return <PreMarketEarningsIcon size={20} />;
    case "regular":
      return <span className={cn("h-2 w-2 shrink-0 rounded-full", MARKET_OPEN_DOT_GREEN)} aria-hidden />;
    case "post":
      return <PostMarketEarningsIcon size={24} />;
    default:
      return <span className="h-2 w-2 shrink-0 rounded-full bg-[#71717A]" aria-hidden />;
  }
}

/**
 * Markets header line — matches `UsEquityMarketSessionBadge` session copy and visuals.
 */
export function UsMarketsSessionLabel({ className }: { className?: string }) {
  const [display, setDisplay] = useState(() => getUsEquitySessionBadgeDisplay(new Date()));

  useEffect(() => {
    const tick = () => setDisplay(getUsEquitySessionBadgeDisplay(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 text-[13px] font-medium leading-5 text-[#71717A]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <MarketsSessionStatusIcon display={display} />
      <span className="min-w-0" suppressHydrationWarning>
        {formatUsEquitySessionBadgeLabel(display)}
      </span>
    </div>
  );
}
