"use client";

import { useEffect, useState } from "react";

import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import {
  formatMinutesShort,
  getUsEquitySessionBadgeDisplay,
  type UsEquitySessionBadgeDisplay,
} from "@/lib/market/us-equity-market-session";
import { cn } from "@/lib/utils";

function BadgeRow({ display }: { display: UsEquitySessionBadgeDisplay }) {
  switch (display.kind) {
    case "pre":
      return (
        <>
          <PreMarketEarningsIcon size={20} />
          <span>Pre-market open</span>
        </>
      );
    case "regular":
      return (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#16A34A]" aria-hidden />
          <span>Open market</span>
        </>
      );
    case "post":
      return (
        <>
          <PostMarketEarningsIcon size={20} />
          <span>After-hours open</span>
        </>
      );
    case "pre_opens_soon":
      return (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#71717A]" aria-hidden />
          <span>Pre-market opens in {formatMinutesShort(display.minutesUntilPre)}</span>
        </>
      );
    default:
      return (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#71717A]" aria-hidden />
          <span>Market closed</span>
        </>
      );
  }
}

type Props = {
  className?: string;
};

export function UsEquityMarketSessionBadge({ className }: Props) {
  const [display, setDisplay] = useState<UsEquitySessionBadgeDisplay>(() =>
    getUsEquitySessionBadgeDisplay(new Date()),
  );

  useEffect(() => {
    const tick = () => setDisplay(getUsEquitySessionBadgeDisplay(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-[#71717A]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <BadgeRow display={display} />
    </div>
  );
}
