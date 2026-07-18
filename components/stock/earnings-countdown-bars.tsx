import { cn } from "@/lib/utils";
import {
  EARNINGS_COUNTDOWN_BARS,
  earningsCountdownFilledBars,
} from "@/lib/market/earnings-countdown";

/** 12-segment countdown meter from the stock Earnings tab. */
export function EarningsCountdownBars({
  daysLeft,
  className,
}: {
  daysLeft: number;
  className?: string;
}) {
  const filledBars = earningsCountdownFilledBars(daysLeft);
  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)} aria-hidden>
      {Array.from({ length: EARNINGS_COUNTDOWN_BARS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-3 w-[3px] max-w-[3px] shrink-0 rounded-[1px]",
            i < filledBars ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
          )}
        />
      ))}
    </div>
  );
}
