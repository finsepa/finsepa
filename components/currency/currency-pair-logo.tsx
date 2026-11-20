"use client";

import { forexPairFlagSrcs } from "@/lib/market/currency-pair-flags";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "28" | "md" | "40" | "lg";

/** Same outer frame as {@link CompanyLogo}. */
const LOGO_BOX_SIZE: Record<LogoSize, string> = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  "28": "h-7 w-7",
  md: "h-8 w-8",
  "40": "h-10 w-10",
  lg: "h-12 w-12",
};

const LOGO_PX: Record<LogoSize, number> = { xs: 20, sm: 24, "28": 28, md: 32, "40": 40, lg: 48 };

/**
 * Overlapping base + quote circular flags for an FX pair.
 * Same height as {@link CompanyLogo}; slightly wider so the two flags have breathing room.
 */
export function CurrencyPairLogo({
  symbol,
  size = "md",
  className,
  eagerLoad = false,
}: {
  /** Pair code or EODHD symbol (`EURUSD` / `EURUSD.FOREX`). */
  symbol: string;
  size?: LogoSize;
  className?: string;
  eagerLoad?: boolean;
}) {
  const flags = forexPairFlagSrcs(symbol);
  if (!flags) return null;

  const px = LOGO_PX[size];
  /** Slightly smaller discs + wider frame → less crush between flags. */
  const flagPx = Math.max(12, Math.round(px * 0.7));
  const widthPx = Math.round(px * 1.22);
  const loading = eagerLoad ? "eager" : "lazy";
  /** Separates the front flag using the row/card fill (`--fs-surface`), not a light ring. */
  const quoteRingShadow =
    "0 0 0 2px var(--fs-surface), 0px 1px 2px 0px rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))";

  return (
    <div
      className={cn(LOGO_BOX_SIZE[size], "relative shrink-0 overflow-visible", className)}
      style={{ width: widthPx, height: px }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public SVG */}
      <img
        src={flags.baseSrc}
        alt=""
        width={flagPx}
        height={flagPx}
        loading={loading}
        decoding="async"
        fetchPriority={eagerLoad ? "high" : undefined}
        className="absolute left-0 top-1/2 z-[1] -translate-y-1/2 rounded-full object-cover shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]"
        style={{ width: flagPx, height: flagPx }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static public SVG */}
      <img
        src={flags.quoteSrc}
        alt=""
        width={flagPx}
        height={flagPx}
        loading={loading}
        decoding="async"
        fetchPriority={eagerLoad ? "high" : undefined}
        className="absolute right-0 top-1/2 z-[2] -translate-y-1/2 rounded-full object-cover"
        style={{ width: flagPx, height: flagPx, boxShadow: quoteRingShadow }}
      />
      <span className="sr-only">
        {flags.base}/{flags.quote}
      </span>
    </div>
  );
}
