"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { UserRound } from "@/lib/icons";
import { format, isValid, parseISO } from "date-fns";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { SuperinvestorFollowStarToggle } from "@/components/superinvestors/superinvestor-follow-star-toggle";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { cn } from "@/lib/utils";

function avatarNeedsDarkTile(src: string): boolean {
  return src.includes("blackrock");
}

/** Local `/public` fund avatars — native `img` + onError; see `SuperinvestorProfileAvatar`. */
function FundRowAvatar({ src, displayName }: { src: string | null | undefined; displayName: string }) {
  const [failed, setFailed] = useState(false);
  const trimmed = typeof src === "string" ? src.trim() : "";
  if (!trimmed || failed) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stroke-muted bg-surface-muted text-fg-muted"
        aria-hidden
      >
        <UserRound className="h-5 w-5" strokeWidth={1.75} />
      </span>
    );
  }

  const darkTile = avatarNeedsDarkTile(trimmed);

  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-stroke-muted",
        darkTile ? "bg-fg" : "bg-surface-muted",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- public /superinvestors avatars */}
      <img
        src={trimmed}
        alt={displayName}
        width={40}
        height={40}
        className={cn("h-full w-full", darkTile ? "object-contain p-1.5" : "object-cover")}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** Desktop: star + avatar + fund + size + count + last update + top 5 holdings. */
const colLayout =
  "grid w-full min-w-0 grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2";

/** Columns inside row `Link` (after star). */
const rowLinkGrid =
  "grid w-full min-w-0 grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2";

/** Mobile: fund block (left) · last updated (right). */
const mobileColLayout = "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-2";

const starToggleClassName =
  "hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3";

const screenerTickerSublineClass = "text-[12px] font-normal leading-4 !text-fg-muted";

const numericCellClass = cn(
  "min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const numericHeaderClass = cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS);

export type SuperinvestorsFundRowModel = {
  href: string;
  displayName: string;
  /** Public path under `/public` (e.g. `/superinvestors/warren-buffett.png`). When omitted, a generic placeholder is shown. */
  avatarSrc?: string | null;
  totalValueUsd: number;
  positionCount: number;
  filingDate: string | null;
  /** Top five positions by value (same order as portfolio). */
  topHoldings: { issuer: string; ticker: string | null }[];
};

function formatFilingDate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy");
}

function stocksLabel(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "stock" : "stocks"}`;
}

function SuperinvestorsFundTableInner({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  return (
    <ScreenerTableScroll>
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
          <div
            className={cn(
              mobileColLayout,
              "min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted sm:hidden",
            )}
          >
            <div className="min-w-0 text-left">Fund</div>
            <div className={numericHeaderClass}>Last updated</div>
          </div>
          <div
            className={cn(
              colLayout,
              "hidden min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted sm:grid",
            )}
          >
            <div className="hidden sm:block" aria-hidden />
            {/* Span avatar + name columns so "Fund" lines up with the left edge of centered 40px avatars (48px track → 4px inset). */}
            <div className="col-span-2 col-start-2 self-center pl-1 text-left">Fund</div>
            <div className={numericHeaderClass}>Size</div>
            <div className={numericHeaderClass}>No. of stocks</div>
            <div className={numericHeaderClass}>Last updated</div>
            <div className={numericHeaderClass}>Top 5 holdings</div>
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>

      {rows.map((r, rowIdx) => (
        <div key={r.href} className={SCREENER_TABLE_DATA_ROW_CLASS}>
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            {/* Mobile row */}
            <div
              className={cn(
                mobileColLayout,
                "items-start py-3 sm:hidden",
                SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
              )}
            >
              <div className="flex min-w-0 items-start gap-1.5 text-left">
                <SuperinvestorFollowStarToggle
                  className={cn(
                    "flex w-6 shrink-0 items-center justify-center px-1 pt-0.5 sm:w-10 sm:px-3",
                  )}
                  profileHref={r.href}
                  label={r.displayName}
                />
                <Link
                  href={r.href}
                  className="flex min-w-0 flex-1 items-start gap-3 text-fg no-underline visited:text-fg"
                  aria-label={`Open ${r.displayName}`}
                >
                  <div className="flex shrink-0 justify-center pt-0.5">
                    <FundRowAvatar src={r.avatarSrc} displayName={r.displayName} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-[3px] decoration-fg group-hover/row:underline">
                      {r.displayName}
                    </div>
                    <div className={screenerTickerSublineClass}>
                      <span className="tabular-nums">{formatUsdCompact(r.totalValueUsd)}</span>
                      <span> · </span>
                      <span className="tabular-nums">{stocksLabel(r.positionCount)}</span>
                    </div>
                  </div>
                </Link>
              </div>
              <div className={cn(numericCellClass, "self-start pt-0.5")}>
                {formatFilingDate(r.filingDate)}
              </div>
            </div>

            {/* Desktop row */}
            <div
              className={cn(
                "hidden h-[60px] max-h-[60px] items-center sm:flex",
                SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
              )}
            >
              <SuperinvestorFollowStarToggle
                className={starToggleClassName}
                profileHref={r.href}
                label={r.displayName}
              />
              <Link
                href={r.href}
                className={cn(
                  rowLinkGrid,
                  "min-h-0 flex-1 items-center text-fg no-underline visited:text-fg",
                )}
                aria-label={`Open ${r.displayName}`}
              >
                <div className="flex justify-center">
                  <FundRowAvatar src={r.avatarSrc} displayName={r.displayName} />
                </div>

                <div className="min-w-0 text-left">
                  <div className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-[3px] decoration-fg group-hover/row:underline">
                    {r.displayName}
                  </div>
                </div>

                <div className={numericCellClass}>{formatUsdCompact(r.totalValueUsd)}</div>

                <div className={numericCellClass}>
                  {r.positionCount.toLocaleString("en-US")} {r.positionCount === 1 ? "Stock" : "Stocks"}
                </div>

                <div className={numericCellClass}>{formatFilingDate(r.filingDate)}</div>

                <div
                  className={cn(
                    "flex min-h-0 min-w-0 max-h-[60px] shrink items-center justify-end gap-1 overflow-hidden",
                    TABLE_END_ALIGNED_PAD_CLASS,
                  )}
                >
                  {r.topHoldings.slice(0, 5).map((h, i) => {
                    const sym = h.ticker?.trim() ? h.ticker.trim().toUpperCase() : null;
                    const logoUrl = sym ? resolveEquityLogoUrlFromListingTicker(sym) : "";
                    return (
                      <CompanyLogo
                        key={`${sym ?? h.issuer}-${i}`}
                        name={h.issuer}
                        logoUrl={logoUrl}
                        symbol={sym ?? undefined}
                        size="28"
                      />
                    );
                  })}
                </div>
              </Link>
            </div>
          </div>
          {rowIdx < rows.length - 1 ? (
            <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
          ) : null}
        </div>
      ))}
    </ScreenerTableScroll>
  );
}

export const SuperinvestorsFundTable = memo(SuperinvestorsFundTableInner);
