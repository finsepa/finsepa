"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, PanelLeftOpen, Star } from "@/lib/icons";

import { CompanyLogo } from "@/components/screener/company-logo";
import { dropdownMenuFloatingScrollbarClassName } from "@/components/design-system/dropdown-menu-styles";
import {
  WATCHLIST_PANEL_WIDTH_PX,
  WATCHLIST_RAIL_WIDTH_MOTION_CLASS,
  useWatchlistRailLayout,
} from "@/components/layout/watchlist-rail-layout-context";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { shellChromeToggleButtonClass } from "@/components/layout/shell-chrome-toggle-button";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { resolveWatchlistRailHref } from "@/lib/watchlist/watchlist-rail-href";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { cn } from "@/lib/utils";

function hasRailQuote(row: WatchlistEnrichedItem): boolean {
  return (
    (row.price != null && Number.isFinite(row.price)) ||
    (row.pct1d != null && Number.isFinite(row.pct1d))
  );
}

function formatRailPrice(n: number | null, kind: WatchlistEnrichedItem["kind"]): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (kind === "crypto" && Math.abs(n) < 1) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRailPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function RailPriceSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-14 animate-pulse rounded bg-[#E4E4E7]" />
      <div className="h-4 w-10 animate-pulse rounded bg-[#F4F4F5]" />
    </div>
  );
}

function RailChange({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-[12px] font-normal leading-5 tabular-nums",
        positive ? "text-[#16A34A]" : "text-[#DC2626]",
      )}
    >
      {formatRailPercent(value)}
    </span>
  );
}

function WatchlistRailRow({
  row,
  pathname,
  tabParam,
  pricesLoading,
  loading,
}: {
  row: WatchlistEnrichedItem;
  pathname: string;
  tabParam: string | null;
  pricesLoading: boolean;
  loading: boolean;
}) {
  const symbolLabel =
    row.kind === "crypto" ? eodhdCryptoSpotTickerDisplay(row.symbol) : row.symbol;
  const href = resolveWatchlistRailHref(row, { pathname, tabParam });
  const showQuoteSkeleton = pricesLoading || (loading && !hasRailQuote(row));
  const priceText = formatRailPrice(row.price, row.kind);

  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F4F4F5]"
    >
      <CompanyLogo
        name={row.name}
        logoUrl={row.logoUrl ?? ""}
        symbol={row.symbol}
        size="sm"
      />
      <span className="min-w-0 shrink truncate text-[14px] font-normal leading-5 text-[#09090B] underline-offset-2 decoration-[#71717A] group-hover:underline">
        {symbolLabel}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2 font-['Inter'] tabular-nums">
        {showQuoteSkeleton ? (
          <RailPriceSkeleton />
        ) : (
          <>
            {priceText ? (
              <span className="text-[14px] font-normal leading-5 text-[#09090B]">{priceText}</span>
            ) : null}
            <RailChange value={row.pct1d} />
          </>
        )}
      </div>
    </Link>
  );
}

function WatchlistRailSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="h-6 w-6 shrink-0 animate-pulse rounded-[8px] bg-[#E4E4E7]" />
          <div className="h-4 w-12 animate-pulse rounded bg-[#E4E4E7]" />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-5 w-14 animate-pulse rounded bg-[#E4E4E7]" />
            <div className="h-4 w-10 animate-pulse rounded bg-[#F4F4F5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

const watchlistRailSurfaceClass =
  "flex h-full min-h-0 flex-col overflow-hidden bg-white md:rounded-none";

function WatchlistRailToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = expanded ? "Collapse watchlist" : "Expand watchlist";
  return (
    <TopbarDelayedTooltip label={label} placement="left">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={label}
        className={shellChromeToggleButtonClass}
      >
        {expanded ? (
          <PanelLeftOpen className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        ) : (
          <Star className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </TopbarDelayedTooltip>
  );
}

function isFullWatchlistPage(pathname: string): boolean {
  return pathname === "/watchlist" || pathname.startsWith("/watchlist/");
}

export function WatchlistRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { collapsed, toggleCollapsed, outerWidthPx } = useWatchlistRailLayout();
  const expanded = !collapsed;
  const { items, empty, showSkeleton, error, pricesLoading, loading } = useWatchlistEnrichedItems({
    enabled: expanded,
  });

  if (isFullWatchlistPage(pathname)) {
    return null;
  }

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "hidden h-full min-h-0 shrink-0 overflow-hidden md:flex md:border-l md:border-[#E4E4E7]",
        WATCHLIST_RAIL_WIDTH_MOTION_CLASS,
      )}
      style={{ width: `${outerWidthPx}px` }}
      aria-label="Watchlist panel"
    >
      <div
        className={watchlistRailSurfaceClass}
        style={{ width: expanded ? `${WATCHLIST_PANEL_WIDTH_PX}px` : "100%" }}
      >
        <div
          className={cn(
            "flex shrink-0 items-center pt-2",
            expanded ? "justify-between gap-2 px-2 pl-3 pr-2" : "justify-center px-1",
          )}
        >
          {expanded ? (
            <Link
              href="/watchlist"
              prefetch={false}
              className="flex min-w-0 items-center gap-0.5 truncate pl-1 text-sm font-semibold leading-5 text-[#52525B] no-underline transition-colors hover:text-[#09090B] hover:underline"
            >
              Watchlist
              <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          ) : (
            <span className="sr-only">Watchlist</span>
          )}
          <WatchlistRailToggle expanded={expanded} onToggle={toggleCollapsed} />
        </div>

        <div
          className={cn(
            "grid min-h-0 flex-1 transition-[grid-template-rows] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "min-h-0 overflow-y-auto overscroll-y-contain px-1 pb-2",
                dropdownMenuFloatingScrollbarClassName,
              )}
            >
              {showSkeleton ? <WatchlistRailSkeleton /> : null}
              {!showSkeleton && empty ? (
                <p className="px-3 py-4 text-[13px] leading-5 text-[#71717A]">
                  Star symbols from any page to build your watchlist.
                </p>
              ) : null}
              {!showSkeleton && error ? (
                <p className="px-3 py-4 text-[13px] leading-5 text-[#DC2626]">{error}</p>
              ) : null}
              {!showSkeleton && !empty && !error ? (
                <div className="flex flex-col">
                  {items.map((row) => (
                    <WatchlistRailRow
                      key={row.entryId}
                      row={row}
                      pathname={pathname}
                      tabParam={tabParam}
                      pricesLoading={pricesLoading}
                      loading={loading}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
