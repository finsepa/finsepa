"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { UserRound } from "@/lib/icons";
import { format, isValid, parseISO } from "date-fns";

import { CompanyLogo } from "@/components/screener/company-logo";
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]"
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
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] ring-1 ring-white",
        darkTile ? "bg-[#09090B]" : "bg-[#F4F4F5]",
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
  "grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-3";

/** Columns inside row `Link` (after star). */
const rowLinkGrid =
  "grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-3";

/** Mobile: fund block (left) · last updated (right). */
const mobileColLayout = "grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-3";

const starToggleClassName = "flex w-6 shrink-0 items-center justify-center px-1 sm:w-10 sm:px-3";

const screenerTickerSublineClass = "text-[12px] font-normal leading-4 !text-[#71717A]";

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
    <div className="min-w-0 -mx-4 sm:mx-0">
      <div className="min-w-0">
        <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
          {/* One wrapper so divide-y does not treat the hidden breakpoint header as a separate row. */}
          <div className="bg-white">
            <div
              className={`grid ${mobileColLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:hidden`}
            >
              <div className="min-w-0 pl-1 text-left">Fund</div>
              <div className="min-w-0 text-right">Last updated</div>
            </div>
            <div
              className={`hidden ${colLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:grid`}
            >
              <div className="hidden sm:block" aria-hidden />
              {/* Span avatar + name columns so "Fund" lines up with the left edge of centered 40px avatars (48px track → 4px inset). */}
              <div className="col-span-2 col-start-2 self-center pl-1 text-left">Fund</div>
              <div className="min-w-0 text-right">Size</div>
              <div className="min-w-0 text-right">No. of stocks</div>
              <div className="min-w-0 text-right">Last updated</div>
              <div className="min-w-0 text-right">Top 5 holdings</div>
            </div>
          </div>

          {rows.map((r) => (
            <div
              key={r.href}
              className="group bg-white transition-colors duration-75 hover:bg-neutral-50"
            >
              {/* Mobile row */}
              <div className={`grid ${mobileColLayout} items-start px-4 py-3 sm:hidden`}>
                <div className="flex min-w-0 items-start gap-1.5 text-left">
                  <SuperinvestorFollowStarToggle
                    className={cn(starToggleClassName, "pt-0.5")}
                    profileHref={r.href}
                    label={r.displayName}
                  />
                  <Link
                    href={r.href}
                    className="flex min-w-0 flex-1 items-start gap-3 text-[#09090B] no-underline visited:text-[#09090B]"
                    aria-label={`Open ${r.displayName}`}
                  >
                    <div className="flex shrink-0 justify-center pt-0.5">
                      <FundRowAvatar src={r.avatarSrc} displayName={r.displayName} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-[3px] decoration-[#09090B] group-hover:underline">
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
                <div className="min-w-0 self-start pt-0.5 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                  {formatFilingDate(r.filingDate)}
                </div>
              </div>

              {/* Desktop row */}
              <div
                className={`hidden ${colLayout} h-[60px] max-h-[60px] items-center px-4 sm:grid`}
              >
                <SuperinvestorFollowStarToggle
                  className={starToggleClassName}
                  profileHref={r.href}
                  label={r.displayName}
                />
                <Link
                  href={r.href}
                  className={`${rowLinkGrid} col-span-6 col-start-2 grid h-full min-w-0 items-center text-[#09090B] no-underline visited:text-[#09090B]`}
                  aria-label={`Open ${r.displayName}`}
                >
                  <div className="flex justify-center">
                    <FundRowAvatar src={r.avatarSrc} displayName={r.displayName} />
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-[3px] decoration-[#09090B] group-hover:underline">
                      {r.displayName}
                    </div>
                  </div>

                  <div className="min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {formatUsdCompact(r.totalValueUsd)}
                  </div>

                  <div className="min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {r.positionCount.toLocaleString("en-US")} {r.positionCount === 1 ? "Stock" : "Stocks"}
                  </div>

                  <div className="min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {formatFilingDate(r.filingDate)}
                  </div>

                  <div className="flex min-h-0 min-w-0 max-h-[60px] shrink items-center justify-end gap-1 overflow-hidden">
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
          ))}
        </div>
      </div>
    </div>
  );
}

export const SuperinvestorsFundTable = memo(SuperinvestorsFundTableInner);
