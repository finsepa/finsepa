"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import { PortfolioOwnerName } from "@/components/portfolios/portfolio-owner-name";
import { UserAvatar } from "@/components/user/user-avatar";
import type { PublicListingRow } from "@/components/portfolios/portfolios-directory-client";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { cn } from "@/lib/utils";

const colLayout =
  "grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(6.5rem,1fr)_minmax(5.5rem,1fr)_minmax(0,1.35fr)] gap-x-3";

const rowLinkGrid =
  "grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(6.5rem,1fr)_minmax(5.5rem,1fr)_minmax(0,1.35fr)] gap-x-3";

const mobileColLayout = "grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-3";

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
  if (n == null || !Number.isFinite(n)) return "text-[#09090B]";
  if (Math.abs(n) < 0.0005) return "text-[#09090B]";
  return n >= 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function initialsFromOwnerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function TopFiveHoldingsLogos({ symbols }: { symbols: string[] }) {
  if (symbols.length === 0) {
    return <span className="text-[14px] font-normal leading-5 text-[#A1A1AA]">—</span>;
  }

  return (
    <div className="flex flex-row items-center justify-end">
      {symbols.map((sym, i) => (
        <div key={`${sym}-${i}`} className="-ml-1 first:ml-0" style={{ zIndex: symbols.length - i }}>
          <CompanyLogo
            name={sym}
            logoUrl={displayLogoUrlForPortfolioSymbol(sym)}
            symbol={sym}
            size="28"
          />
        </div>
      ))}
    </div>
  );
}

export function PortfoliosDirectoryTable({ listings }: { listings: PublicListingRow[] }) {
  return (
    <div className="min-w-0 -mx-4 sm:mx-0">
      <div className="min-w-0 overflow-x-auto">
        <div className="min-w-[720px] divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
          <div className="bg-white">
            <div
              className={`grid ${mobileColLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:hidden`}
            >
              <div className="min-w-0 text-left">Investor</div>
              <div className="min-w-0 text-right">ATH</div>
            </div>
            <div
              className={`hidden ${colLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] sm:grid`}
            >
              <div className="min-w-0 text-left">Investor</div>
              <div className="min-w-0 text-right">Value</div>
              <div className="min-w-0 text-right">No. of Holdings</div>
              <div className="min-w-0 text-right">ATH</div>
              <div className="min-w-0 text-right">Top 5 Holdings</div>
            </div>
          </div>

          {listings.map((listing) => {
            const m = listing.metrics;
            const value = metricNum(m, "valueUsd");
            const ath = metricNum(m, "returnsAthPct") ?? metricNum(m, "totalProfitPct");
            const holdingCount = metricNum(m, "holdingCount");
            const ownerName = metricStr(m, "ownerDisplayName") ?? "Member";
            const ownerAvatar = metricStr(m, "ownerAvatarUrl");
            const topSyms = metricStringArray(m, "topSymbols").slice(0, 5);

            return (
              <div
                key={listing.id}
                className="group bg-white transition-colors duration-75 hover:bg-neutral-50"
              >
                <div className={`grid ${mobileColLayout} items-center px-4 py-3 sm:hidden`}>
                  <Link
                    href={`/portfolios/${listing.id}`}
                    prefetch={false}
                    className="flex min-w-0 items-center gap-3 text-[#09090B] no-underline visited:text-[#09090B]"
                  >
                    <UserAvatar
                      imageSrc={
                        ownerAvatar && (ownerAvatar.startsWith("http") || ownerAvatar.startsWith("/")) ?
                          ownerAvatar
                        : null
                      }
                      initials={initialsFromOwnerName(ownerName)}
                      size="menu"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold leading-5 underline-offset-2 group-hover:underline">
                        {listing.name}
                      </div>
                      <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                        <PortfolioOwnerName name={ownerName} />
                      </div>
                      <div className="mt-0.5 text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                        {value != null ? formatUsdCompact(value) : "—"}
                        {holdingCount != null ? ` · ${Math.round(holdingCount)} holdings` : null}
                      </div>
                    </div>
                  </Link>
                  <div
                    className={cn(
                      "min-w-0 text-right text-[14px] font-medium leading-5 tabular-nums",
                      athReturnClass(ath),
                    )}
                  >
                    {fmtPct(ath)}
                  </div>
                </div>

                <Link
                  href={`/portfolios/${listing.id}`}
                  prefetch={false}
                  className={`hidden ${rowLinkGrid} h-[60px] max-h-[60px] items-center px-4 text-[#09090B] no-underline visited:text-[#09090B] sm:grid`}
                  aria-label={`View portfolio ${listing.name} by ${ownerName}`}
                >
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <UserAvatar
                      imageSrc={
                        ownerAvatar && (ownerAvatar.startsWith("http") || ownerAvatar.startsWith("/")) ?
                          ownerAvatar
                        : null
                      }
                      initials={initialsFromOwnerName(ownerName)}
                      size="menu"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold leading-5 underline-offset-2 group-hover:underline">
                        {listing.name}
                      </div>
                      <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                        <PortfolioOwnerName name={ownerName} />
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {value != null ? formatUsdCompact(value) : "—"}
                  </div>

                  <div className="min-w-0 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {holdingCount != null ? Math.round(holdingCount).toLocaleString("en-US") : "—"}
                  </div>

                  <div
                    className={cn(
                      "min-w-0 text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                      athReturnClass(ath),
                    )}
                  >
                    {fmtPct(ath)}
                  </div>

                  <div className="flex min-h-0 min-w-0 max-h-[60px] items-center justify-end overflow-hidden">
                    <TopFiveHoldingsLogos symbols={topSyms} />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
