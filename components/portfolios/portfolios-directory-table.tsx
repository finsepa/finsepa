"use client";

import Link from "next/link";

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
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { PortfolioOwnerName } from "@/components/portfolios/portfolio-owner-name";
import { UserAvatar } from "@/components/user/user-avatar";
import type { PublicListingRow } from "@/components/portfolios/portfolios-directory-client";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { cn } from "@/lib/utils";

const colLayout =
  "grid w-full min-w-0 grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(6.5rem,1fr)_minmax(5.5rem,1fr)_minmax(0,1.35fr)] gap-x-3";

const mobileColLayout = "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-3";

const numericHeaderClass = cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS);

const numericCellClass = cn(
  "min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const startCellClass = cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS);

function metricNum(m: Record<string, unknown>, key: string): number | null {
  const v = m[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metricStr(m: Record<string, unknown>, key: string): string | null {
  const v = m[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function metricStringArray(m: Record<string, unknown>, key: string): string[] {
  const v = m[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const body = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n > 0) return `+${body}%`;
  if (n < 0) return `-${body}%`;
  return `${body}%`;
}

function athReturnClass(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-fg";
  if (Math.abs(n) < 0.0005) return "text-fg";
  return n >= 0 ? "text-up" : "text-down";
}

function initialsFromOwnerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function TopFiveHoldingsLogos({ symbols }: { symbols: string[] }) {
  if (symbols.length === 0) {
    return <span className="text-[14px] font-normal leading-5 text-fg-subtle">—</span>;
  }

  return (
    <div className="flex flex-row items-center justify-end">
      {symbols.map((sym, i) => (
        <div key={`${sym}-${i}`} className="-ml-1 first:ml-0" style={{ zIndex: symbols.length - i }}>
          <div className="overflow-hidden rounded-full ring-2 ring-stroke-subtle">
            <CompanyLogo
              name={sym}
              logoUrl={displayLogoUrlForPortfolioSymbol(sym)}
              symbol={sym}
              size="28"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortfoliosDirectoryTable({ listings }: { listings: PublicListingRow[] }) {
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
            <div className={startCellClass}>Investor</div>
            <div className={numericHeaderClass}>ATH</div>
          </div>
          <div
            className={cn(
              colLayout,
              "hidden min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted sm:grid",
            )}
          >
            <div className={startCellClass}>Investor</div>
            <div className={numericHeaderClass}>Value</div>
            <div className={numericHeaderClass}>No. of Holdings</div>
            <div className={numericHeaderClass}>ATH</div>
            <div className={numericHeaderClass}>Top 5 Holdings</div>
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>

      {listings.map((listing, rowIdx) => {
        const m = listing.metrics;
        const value = metricNum(m, "valueUsd");
        const ath = metricNum(m, "returnsAthPct") ?? metricNum(m, "totalProfitPct");
        const holdingCount = metricNum(m, "holdingCount");
        const ownerName = metricStr(m, "ownerDisplayName") ?? "Member";
        const ownerAvatar = metricStr(m, "ownerAvatarUrl");
        const topSyms = metricStringArray(m, "topSymbols").slice(0, 5);
        const avatarSrc =
          ownerAvatar && (ownerAvatar.startsWith("http") || ownerAvatar.startsWith("/")) ?
            ownerAvatar
          : null;

        return (
          <div key={listing.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  mobileColLayout,
                  "items-center py-3 sm:hidden",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
              >
                <Link
                  href={`/portfolios/${listing.id}`}
                  prefetch={false}
                  className={cn(
                    "flex min-w-0 items-center gap-3 text-fg no-underline visited:text-fg",
                    TABLE_START_ALIGNED_PAD_CLASS,
                  )}
                >
                  <UserAvatar imageSrc={avatarSrc} initials={initialsFromOwnerName(ownerName)} size="menu" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-5 underline-offset-2 group-hover/row:underline">
                      {listing.name}
                    </div>
                    <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                      <PortfolioOwnerName name={ownerName} />
                    </div>
                    <div className="mt-0.5 text-[12px] font-normal leading-4 tabular-nums text-fg-muted">
                      {value != null ? formatUsdCompact(value) : "—"}
                      {holdingCount != null ? ` · ${Math.round(holdingCount)} holdings` : null}
                    </div>
                  </div>
                </Link>
                <div
                  className={cn(
                    "min-w-0 text-right text-[14px] font-medium leading-5 tabular-nums",
                    TABLE_END_ALIGNED_PAD_CLASS,
                    athReturnClass(ath),
                  )}
                >
                  {fmtPct(ath)}
                </div>
              </div>

              <Link
                href={`/portfolios/${listing.id}`}
                prefetch={false}
                className={cn(
                  colLayout,
                  "hidden h-[60px] max-h-[60px] items-center text-fg no-underline visited:text-fg sm:grid",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
                aria-label={`View portfolio ${listing.name} by ${ownerName}`}
              >
                <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
                  <UserAvatar imageSrc={avatarSrc} initials={initialsFromOwnerName(ownerName)} size="menu" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-5 underline-offset-2 group-hover/row:underline">
                      {listing.name}
                    </div>
                    <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                      <PortfolioOwnerName name={ownerName} />
                    </div>
                  </div>
                </div>

                <div className={numericCellClass}>{value != null ? formatUsdCompact(value) : "—"}</div>

                <div className={numericCellClass}>
                  {holdingCount != null ? Math.round(holdingCount).toLocaleString("en-US") : "—"}
                </div>

                <div
                  className={cn(
                    "min-w-0 text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                    TABLE_END_ALIGNED_PAD_CLASS,
                    athReturnClass(ath),
                  )}
                >
                  {fmtPct(ath)}
                </div>

                <div
                  className={cn(
                    "flex min-h-0 min-w-0 max-h-[60px] items-center justify-end overflow-hidden",
                    TABLE_END_ALIGNED_PAD_CLASS,
                  )}
                >
                  <TopFiveHoldingsLogos symbols={topSyms} />
                </div>
              </Link>
            </div>
            {rowIdx < listings.length - 1 ? (
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            ) : null}
          </div>
        );
      })}
    </ScreenerTableScroll>
  );
}
