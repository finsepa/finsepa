"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, UserRound } from "@/lib/icons";
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
import { formatSuperinvestorPerformancePct } from "@/lib/superinvestors/superinvestor-performance-headline";
import { cn } from "@/lib/utils";

function avatarNeedsDarkTile(src: string): boolean {
  return src.includes("blackrock") || src.includes("baillie-gifford");
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
        // Fixed dark tile — `bg-fg` flips to white in dark mode and frames these logos.
        darkTile ? "bg-[#141414]" : "bg-surface-muted",
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

/** Desktop: star + avatar + fund + size + performance + count + last update + top 5 holdings. */
const colLayout =
  "grid w-full min-w-0 grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2";

/** Columns inside row `Link` (after star). */
const rowLinkGrid =
  "grid w-full min-w-0 grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2";

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
  /** Buy/sell count in the latest 13F filing quarter (Activity tab). */
  activityCount?: number;
  /** Top five positions by value (same order as portfolio). */
  topHoldings: { issuer: string; ticker: string | null }[];
  /** 1Y rebased book return % from durable performance snapshot; null when not warmed. */
  bookReturnPct1y?: number | null;
};

function formatFilingDate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, "MMM d, yyyy");
}

function stocksCountLabel(count: number) {
  return count.toLocaleString("en-US");
}

type SuperinvestorsSortKey = "size" | "performance" | "updated";

function compareFundRows(
  a: SuperinvestorsFundRowModel,
  b: SuperinvestorsFundRowModel,
  key: SuperinvestorsSortKey,
  dir: "asc" | "desc",
): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "size") return (a.totalValueUsd - b.totalValueUsd) * mul;
  if (key === "performance") {
    const av = a.bookReturnPct1y;
    const bv = b.bookReturnPct1y;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * mul;
  }

  const ad = a.filingDate?.trim() ?? "";
  const bd = b.filingDate?.trim() ?? "";
  if (!ad && !bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  return ad.localeCompare(bd) * mul;
}

function performanceCellLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return formatSuperinvestorPerformancePct(pct);
}

function performanceCellClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return numericCellClass;
  if (pct > 0) return cn(numericCellClass, "text-up");
  if (pct < 0) return cn(numericCellClass, "text-down");
  return numericCellClass;
}

function FundSortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SuperinvestorsSortKey;
  activeKey: SuperinvestorsSortKey;
  dir: "asc" | "desc";
  onSort: (key: SuperinvestorsSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <div className={numericHeaderClass}>
      <button
        type="button"
        className="inline-flex w-full items-center justify-end gap-1 rounded text-[14px] font-medium leading-5 text-fg-muted hover:text-fg"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ?
          dir === "desc" ?
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        : null}
      </button>
    </div>
  );
}

function SuperinvestorsFundTableInner({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  const [sort, setSort] = useState<{ key: SuperinvestorsSortKey; dir: "asc" | "desc" }>({
    key: "size",
    dir: "desc",
  });

  const onSort = (key: SuperinvestorsSortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );
  };

  const sortedRows = [...rows].sort((a, b) => compareFundRows(a, b, sort.key, sort.dir));

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
            <FundSortHeader
              label="Last updated"
              sortKey="updated"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
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
            <FundSortHeader
              label="Size"
              sortKey="size"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
            <FundSortHeader
              label="1Y perf."
              sortKey="performance"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
            <div className={numericHeaderClass}>No. of stocks</div>
            <FundSortHeader
              label="Last updated"
              sortKey="updated"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
            <div className={numericHeaderClass}>Top 5 holdings</div>
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>

      {sortedRows.map((r, rowIdx) => (
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
                      <span className="tabular-nums">{stocksCountLabel(r.positionCount)}</span>
                      {r.bookReturnPct1y != null && Number.isFinite(r.bookReturnPct1y) ? (
                        <>
                          <span> · </span>
                          <span
                            className={cn(
                              "tabular-nums",
                              r.bookReturnPct1y > 0 ? "text-up" : r.bookReturnPct1y < 0 ? "text-down" : "",
                            )}
                          >
                            {formatSuperinvestorPerformancePct(r.bookReturnPct1y)} 1Y
                          </span>
                        </>
                      ) : null}
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

                <div className={performanceCellClass(r.bookReturnPct1y)}>
                  {performanceCellLabel(r.bookReturnPct1y)}
                </div>

                <div className={numericCellClass}>{stocksCountLabel(r.positionCount)}</div>

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
          {rowIdx < sortedRows.length - 1 ? (
            <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
          ) : null}
        </div>
      ))}
    </ScreenerTableScroll>
  );
}

export const SuperinvestorsFundTable = memo(SuperinvestorsFundTableInner);
