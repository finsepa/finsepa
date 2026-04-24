"use client";

import { useEffect, useState } from "react";

import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import {
  getUsEquityMarketSession,
  type UsEquityMarketSession,
} from "@/lib/market/us-equity-market-session";
import { cn } from "@/lib/utils";

function SessionRow({ session }: { session: UsEquityMarketSession }) {
  switch (session) {
    case "pre":
      return (
        <>
          <PreMarketEarningsIcon size={20} />
          <span>Pre-market</span>
        </>
      );
    case "regular":
      return (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#16A34A]" aria-hidden />
          <span className="text-[#09090B]">Open market</span>
        </>
      );
    case "post":
      return (
        <>
          <PostMarketEarningsIcon size={20} />
          <span>Post-market</span>
        </>
      );
    default:
      return (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#A1A1AA]" aria-hidden />
          <span>Market closed</span>
        </>
      );
  }
}

type Props = {
  className?: string;
};

export function UsEquityMarketSessionBadge({ className }: Props) {
  const [session, setSession] = useState<UsEquityMarketSession>(() =>
    getUsEquityMarketSession(new Date()),
  );

  useEffect(() => {
    const tick = () => setSession(getUsEquityMarketSession(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-[#52525B]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <SessionRow session={session} />
    </div>
  );
}
