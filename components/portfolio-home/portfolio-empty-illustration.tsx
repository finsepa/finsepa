import type { CSSProperties } from "react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { ArrowDown, ArrowUp, Bell, CalendarDays, FileText, Plus, Search, Star } from "@/lib/icons";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { cn } from "@/lib/utils";

const ROBINHOOD_LOGO_URL = displayLogoUrlForPortfolioSymbol("HOOD");

const BAR_STRONG = "color-mix(in srgb, var(--fs-fg-muted) 30%, transparent)";
const BAR_SOFT = "color-mix(in srgb, var(--fs-fg-muted) 15%, transparent)";
const CARD_SHADOW = "0px 1px 2px 0px rgba(var(--fs-shadow-rgb), var(--fs-shadow-a-06))";

function Bar({ width, height = 6, strong = false }: { width: number; height?: number; strong?: boolean }) {
  return (
    <span
      className="block rounded-full"
      style={{ width, height, background: strong ? BAR_STRONG : BAR_SOFT }}
    />
  );
}

function SkeletonCard({
  className,
  style,
  chart,
  empty,
}: {
  className?: string;
  style?: CSSProperties;
  chart?: boolean;
  /** Shell only — for stacked cards peeking behind the front one. */
  empty?: boolean;
}) {
  return (
    <div
      className={cn("absolute inset-x-0 rounded-2xl border border-stroke bg-surface", className)}
      style={{ padding: 12, boxShadow: CARD_SHADOW, ...style }}
    >
      {empty ? null : (
        <div className="flex items-center" style={{ gap: 8 }}>
          <CompanyLogo name="Robinhood" symbol="HOOD" logoUrl={ROBINHOOD_LOGO_URL} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 5 }}>
            <Bar width={72} strong />
            <Bar width={44} height={5} />
          </div>
          <div className="flex shrink-0 flex-col items-end" style={{ gap: 5 }}>
            <Bar width={52} strong />
            <Bar width={34} height={5} />
          </div>
        </div>
      )}
      {chart ? (
        <svg
          viewBox="0 0 216 52"
          className="block w-full"
          style={{ height: 52, marginTop: 10, overflow: "visible" }}
          aria-hidden
        >
          <defs>
            <linearGradient id="portfolio-empty-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fs-fg-muted)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--fs-fg-muted)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 42 C 18 40, 26 32, 42 34 S 66 22, 84 26 S 110 36, 128 24 S 156 10, 174 16 S 200 6, 216 4 L 216 52 L 0 52 Z"
            fill="url(#portfolio-empty-area)"
          />
          <path
            d="M0 42 C 18 40, 26 32, 42 34 S 66 22, 84 26 S 110 36, 128 24 S 156 10, 174 16 S 200 6, 216 4"
            fill="none"
            stroke="var(--fs-fg-muted)"
            strokeOpacity="0.45"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
          <circle cx="214" cy="4.5" r="3" fill="var(--fs-fg-muted)" fillOpacity="0.55" />
        </svg>
      ) : null}
    </div>
  );
}

/** Home empty state art — stacked portfolio cards with a placeholder performance line. */
export function PortfolioEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 240, height: 152 }}>
      <SkeletonCard empty style={{ top: 0, height: 60, transform: "scale(0.84)", transformOrigin: "top center", opacity: 0.55 }} />
      <SkeletonCard empty style={{ top: 14, height: 60, transform: "scale(0.92)", transformOrigin: "top center", opacity: 0.8 }} />
      <SkeletonCard chart style={{ top: 30 }} />
      <PlusBadge style={{ right: -10, bottom: -6 }} />
    </div>
  );
}

function PlusBadge({ style }: { style: CSSProperties }) {
  return (
    <span
      className="absolute flex items-center justify-center rounded-full bg-fg text-surface"
      style={{ width: 28, height: 28, boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)`, ...style }}
    >
      <Plus className="size-4" strokeWidth={2.25} />
    </span>
  );
}

function TransactionSkeletonRow({ icon: Icon }: { icon: typeof ArrowUp }) {
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <span
        className="flex shrink-0 items-center justify-center rounded-[6px] text-fg-muted"
        style={{ width: 20, height: 20, background: BAR_SOFT }}
      >
        <Icon style={{ width: 12, height: 12 }} strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
        <Bar width={44} height={5} strong />
        <Bar width={28} height={4} />
      </div>
      <Bar width={24} height={5} strong />
    </div>
  );
}

/** Home chart empty state — flat net-worth chart waiting on its first transactions. */
export function ChartEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 256, height: 140 }}>
      <div
        className="absolute rounded-2xl border border-stroke bg-surface"
        style={{ left: 0, top: 0, width: 200, padding: 12, boxShadow: CARD_SHADOW }}
      >
        <div className="flex flex-col" style={{ gap: 5 }}>
          <Bar width={40} height={5} />
          <Bar width={68} height={8} strong />
        </div>
        <svg viewBox="0 0 176 64" className="block w-full" style={{ height: 64, marginTop: 12 }}>
          {[8, 24, 40].map((y) => (
            <line key={y} x1="0" x2="176" y1={y} y2={y} stroke="var(--fs-fg-muted)" strokeOpacity="0.14" />
          ))}
          <line
            x1="4"
            x2="176"
            y1="56"
            y2="56"
            stroke="var(--fs-fg-muted)"
            strokeOpacity="0.45"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
          <circle cx="4" cy="56" r="3" fill="var(--fs-fg-muted)" fillOpacity="0.55" />
        </svg>
      </div>
      <div
        className="absolute flex flex-col rounded-2xl border border-stroke bg-surface"
        style={{ right: 0, top: 62, width: 132, padding: 10, gap: 10, boxShadow: CARD_SHADOW }}
      >
        <TransactionSkeletonRow icon={ArrowUp} />
        <TransactionSkeletonRow icon={ArrowDown} />
      </div>
      <PlusBadge style={{ right: -10, bottom: -8 }} />
    </div>
  );
}

const ON_FG_STRONG = "color-mix(in srgb, var(--fs-surface) 55%, transparent)";
const ON_FG_SOFT = "color-mix(in srgb, var(--fs-surface) 28%, transparent)";

function PaymentSkeletonRow({ opacity = 1 }: { opacity?: number }) {
  return (
    <div className="flex items-center" style={{ gap: 8, opacity }}>
      <span className="block shrink-0 rounded-[6px]" style={{ width: 20, height: 20, background: BAR_SOFT }} />
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
        <Bar width={56} height={5} strong />
        <Bar width={34} height={4} />
      </div>
      <Bar width={28} height={5} strong />
      <span className="block shrink-0 rounded-full" style={{ width: 26, height: 12, background: BAR_SOFT }} />
    </div>
  );
}

/** Payment history empty state — invoice rows waiting on a first charge, with a card peeking in. */
export function PaymentsEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 256, height: 128 }}>
      <div
        className="absolute flex flex-col rounded-2xl border border-stroke bg-surface"
        style={{ left: 0, top: 0, width: 208, padding: 12, gap: 12, boxShadow: CARD_SHADOW }}
      >
        <PaymentSkeletonRow />
        <PaymentSkeletonRow opacity={0.7} />
        <PaymentSkeletonRow opacity={0.45} />
      </div>
      <div
        className="absolute flex flex-col justify-between rounded-[12px] bg-fg"
        style={{
          right: 0,
          top: 52,
          width: 112,
          height: 70,
          padding: 10,
          transform: "rotate(6deg)",
          boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)`,
        }}
      >
        <span className="block rounded-[4px]" style={{ width: 18, height: 13, background: ON_FG_STRONG }} />
        <div className="flex items-end justify-between">
          <div className="flex flex-col" style={{ gap: 4 }}>
            <span className="block rounded-full" style={{ width: 52, height: 5, background: ON_FG_STRONG }} />
            <span className="block rounded-full" style={{ width: 30, height: 4, background: ON_FG_SOFT }} />
          </div>
          <span className="relative block" style={{ width: 22, height: 14 }}>
            <span className="absolute left-0 top-0 block rounded-full" style={{ width: 14, height: 14, background: ON_FG_STRONG }} />
            <span className="absolute right-0 top-0 block rounded-full" style={{ width: 14, height: 14, background: ON_FG_SOFT }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function NotificationSkeletonCard({
  icon: Icon,
  style,
  titleWidth,
  lineWidth,
}: {
  icon: typeof Bell;
  style: CSSProperties;
  titleWidth: number;
  lineWidth: number;
}) {
  return (
    <div
      className="absolute inset-x-0 flex items-start rounded-2xl border border-stroke bg-surface"
      style={{ padding: 10, gap: 10, boxShadow: CARD_SHADOW, ...style }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-[8px] text-fg-muted"
        style={{ width: 28, height: 28, background: BAR_SOFT }}
      >
        <Icon style={{ width: 14, height: 14 }} strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 5, paddingTop: 2 }}>
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <Bar width={titleWidth} strong />
          <Bar width={18} height={4} />
        </div>
        <Bar width={lineWidth} height={5} />
      </div>
    </div>
  );
}

/** Notifications empty state — a stack of placeholder alerts (earnings, filings) under a bell. */
export function NotificationsEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 232, height: 128 }}>
      <SkeletonCard empty style={{ top: 0, height: 52, transform: "scale(0.86)", transformOrigin: "top center", opacity: 0.55 }} />
      <NotificationSkeletonCard
        icon={FileText}
        titleWidth={64}
        lineWidth={112}
        style={{ top: 12, transform: "scale(0.93)", transformOrigin: "top center", opacity: 0.8 }}
      />
      <NotificationSkeletonCard icon={CalendarDays} titleWidth={80} lineWidth={132} style={{ top: 30 }} />
      <span
        className="absolute flex items-center justify-center rounded-full bg-fg text-surface"
        style={{ right: -10, top: 18, width: 28, height: 28, boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)` }}
      >
        <Bell className="size-4" strokeWidth={2.25} />
      </span>
    </div>
  );
}

const WATCHLIST_SKELETON_ROWS = [
  { symbol: "AAPL", name: "Apple", spark: "M0 12 C 6 11, 10 6, 16 8 S 26 3, 36 2", opacity: 1 },
  { symbol: "NVDA", name: "NVIDIA", spark: "M0 4 C 8 6, 12 11, 20 9 S 30 12, 36 13", opacity: 0.7 },
  { symbol: "TSLA", name: "Tesla", spark: "M0 10 C 6 12, 12 4, 20 7 S 30 5, 36 4", opacity: 0.45 },
] as const;

function WatchlistSkeletonRow({ symbol, name, spark, opacity }: (typeof WATCHLIST_SKELETON_ROWS)[number]) {
  return (
    <div className="flex items-center" style={{ gap: 8, opacity }}>
      <CompanyLogo name={name} symbol={symbol} logoUrl={displayLogoUrlForPortfolioSymbol(symbol)} size="xs" />
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
        <Bar width={48} height={5} strong />
        <Bar width={30} height={4} />
      </div>
      <svg viewBox="0 0 36 15" style={{ width: 36, height: 15, overflow: "visible" }}>
        <path
          d={spark}
          fill="none"
          stroke="var(--fs-fg-muted)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      </svg>
      <Bar width={28} height={5} strong />
    </div>
  );
}

/** Watchlist empty state — saved-asset rows fading out, with a star badge. */
export function WatchlistEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 224, height: 124 }}>
      <SkeletonCard empty style={{ top: 0, height: 52, transform: "scale(0.88)", transformOrigin: "top center", opacity: 0.55 }} />
      <div
        className="absolute inset-x-0 flex flex-col rounded-2xl border border-stroke bg-surface"
        style={{ top: 14, padding: 12, gap: 12, boxShadow: CARD_SHADOW }}
      >
        {WATCHLIST_SKELETON_ROWS.map((row) => (
          <WatchlistSkeletonRow key={row.symbol} {...row} />
        ))}
      </div>
      <span
        className="absolute flex items-center justify-center rounded-full bg-fg text-surface"
        style={{ right: -10, top: 2, width: 28, height: 28, boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)` }}
      >
        <Star className="size-4" strokeWidth={2.25} fill="currentColor" />
      </span>
    </div>
  );
}

function EarningsSkeletonCard({
  symbol,
  name,
  style,
  featured,
}: {
  symbol: string;
  name: string;
  style: CSSProperties;
  featured?: boolean;
}) {
  return (
    <div
      className="absolute flex flex-col rounded-2xl border border-stroke bg-surface"
      style={{ width: 76, padding: 10, boxShadow: CARD_SHADOW, ...style }}
    >
      <span style={{ filter: featured ? undefined : "grayscale(1)" }}>
        <CompanyLogo name={name} symbol={symbol} logoUrl={displayLogoUrlForPortfolioSymbol(symbol)} size="sm" />
      </span>
      <div className="flex flex-col" style={{ gap: 5, marginTop: 22 }}>
        <Bar width={36} strong />
        <Bar width={48} height={5} />
      </div>
    </div>
  );
}

/** Home upcoming earnings empty state — fanned earnings cards with a calendar badge. */
export function EarningsEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 232, height: 116 }}>
      <EarningsSkeletonCard symbol="MSFT" name="Microsoft" style={{ left: 22, top: 18, transform: "rotate(-8deg)", opacity: 0.7 }} />
      <EarningsSkeletonCard symbol="NVDA" name="NVIDIA" style={{ right: 22, top: 18, transform: "rotate(8deg)", opacity: 0.7 }} />
      <EarningsSkeletonCard featured symbol="AAPL" name="Apple" style={{ left: 78, top: 4 }} />
      <span
        className="absolute flex items-center justify-center rounded-full bg-fg text-surface"
        style={{ left: 138, top: -6, width: 28, height: 28, boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)` }}
      >
        <CalendarDays className="size-4" strokeWidth={2.25} />
      </span>
    </div>
  );
}

const SEARCH_CHIP_SHELLS = [
  { top: 0, scale: 0.84, opacity: 0.5 },
  { top: 12, scale: 0.92, opacity: 0.8 },
] as const;

/** Search empty state — a stack of recent-search chips with a search badge. */
export function SearchEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 200, height: 72 }}>
      {SEARCH_CHIP_SHELLS.map(({ top, scale, opacity }) => (
        <span
          key={top}
          className="absolute inset-x-0 rounded-full border border-stroke bg-surface"
          style={{ top, height: 34, opacity, transform: `scale(${scale})`, transformOrigin: "top center", boxShadow: CARD_SHADOW }}
        />
      ))}
      <span
        className="absolute inset-x-0 flex items-center rounded-full border border-stroke bg-surface"
        style={{ top: 26, gap: 10, padding: "4px 14px 4px 4px", boxShadow: CARD_SHADOW }}
      >
        <CompanyLogo name="Apple" symbol="AAPL" logoUrl={displayLogoUrlForPortfolioSymbol("AAPL")} size="sm" />
        <Bar width={52} height={6} strong />
        <span className="flex-1" />
        <Bar width={28} height={5} />
      </span>
      <span
        className="absolute flex items-center justify-center rounded-full bg-fg text-surface"
        style={{ right: -10, bottom: -6, width: 30, height: 30, boxShadow: `${CARD_SHADOW}, 0 0 0 3px var(--fs-surface)` }}
      >
        <Search className="size-4" strokeWidth={2.25} />
      </span>
    </div>
  );
}

function InvestorSkeletonCard({
  style,
  avatarSrc,
  featured,
}: {
  style: CSSProperties;
  avatarSrc: string;
  featured?: boolean;
}) {
  return (
    <div
      className="absolute flex flex-col rounded-2xl border border-stroke bg-surface"
      style={{ width: 84, padding: 8, boxShadow: CARD_SHADOW, ...style }}
    >
      <span
        className="block overflow-hidden rounded-[10px] border border-stroke-muted"
        style={{ height: 50, background: BAR_SOFT }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative public /superinvestors avatar */}
        <img
          src={avatarSrc}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: "center 25%", filter: featured ? undefined : "grayscale(1)" }}
        />
      </span>
      <div className="flex flex-col" style={{ gap: 5, marginTop: 16 }}>
        <Bar width={52} strong />
        <Bar width={36} height={5} />
      </div>
    </div>
  );
}

/** Home superinvestors empty state — fanned investor cards with real avatars. */
export function SuperinvestorsEmptyIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto", className)} style={{ width: 240, height: 126 }}>
      <InvestorSkeletonCard
        avatarSrc="/superinvestors/cathie-wood.png"
        style={{ left: 26, top: 20, transform: "rotate(-8deg)", opacity: 0.7 }}
      />
      <InvestorSkeletonCard
        avatarSrc="/superinvestors/bill-ackman.png"
        style={{ right: 26, top: 20, transform: "rotate(8deg)", opacity: 0.7 }}
      />
      <InvestorSkeletonCard featured avatarSrc="/superinvestors/warren-buffett.png" style={{ left: 78, top: 4 }} />
    </div>
  );
}
