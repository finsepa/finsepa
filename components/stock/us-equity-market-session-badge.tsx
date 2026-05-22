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

function BadgeRow({
  display,
  iconSize = 20,
  dotSizeClass = "h-2 w-2",
}: {
  display: UsEquitySessionBadgeDisplay;
  iconSize?: number;
  dotSizeClass?: string;
}) {
  switch (display.kind) {
    case "pre":
      return (
        <>
          <PreMarketEarningsIcon size={iconSize} />
          <span>Pre-market open</span>
        </>
      );
    case "regular":
      return (
        <>
          <span className={cn(dotSizeClass, "shrink-0 rounded-full bg-[#16A34A]")} aria-hidden />
          <span>Open market</span>
        </>
      );
    case "post":
      return (
        <>
          <PostMarketEarningsIcon size={iconSize} />
          <span>After-hours open</span>
        </>
      );
    case "pre_opens_soon":
      return (
        <>
          <span className={cn(dotSizeClass, "shrink-0 rounded-full bg-[#71717A]")} aria-hidden />
          <span>Pre-market opens in {formatMinutesShort(display.minutesUntilPre)}</span>
        </>
      );
    default:
      return (
        <>
          <span className={cn(dotSizeClass, "shrink-0 rounded-full bg-[#71717A]")} aria-hidden />
          <span>Market closed</span>
        </>
      );
  }
}

type Props = {
  className?: string;
  /** Inline with header timestamp on mobile — smaller icon, 12px body text. */
  variant?: "default" | "inline";
};

export function UsEquityMarketSessionBadge({ className, variant = "default" }: Props) {
  const [display, setDisplay] = useState<UsEquitySessionBadgeDisplay>(() =>
    getUsEquitySessionBadgeDisplay(new Date()),
  );
  const inline = variant === "inline";

  useEffect(() => {
    const tick = () => setDisplay(getUsEquitySessionBadgeDisplay(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center text-[#71717A]",
        inline ? "gap-1 text-[12px] font-normal leading-4" : "gap-1.5 text-[13px] font-medium",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <BadgeRow
        display={display}
        iconSize={inline ? 14 : 20}
        dotSizeClass={inline ? "h-1.5 w-1.5" : "h-2 w-2"}
      />
    </div>
  );
}
