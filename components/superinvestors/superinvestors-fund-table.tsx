"use client";

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

import { CompanyLogo } from "@/components/screener/company-logo";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

/** Screener-style column grid: avatar, fund, size, count, last update, top holdings, chevron. */
const colLayout =
  "grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)_40px] gap-x-3";

export type SuperinvestorsFundRowModel = {
  href: string;
  displayName: string;
  /** Public path under `/public` (e.g. `/superinvestors/warren-buffett.png`). When omitted, a generic placeholder is shown. */
  avatarSrc?: string | null;
  totalValueUsd: number;
  positionCount: number;
  filingDate: string | null;
  topIssuers: string[];
};

function formatFilingDate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy");
}

function SuperinvestorsFundTableInner({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
      >
        <div />
        <div className="text-left">Fund</div>
        <div className="min-w-0 text-right">Size</div>
        <div className="min-w-0 text-right">No. of stocks</div>
        <div className="min-w-0 text-right">Last updated</div>
        <div className="min-w-0 text-left">Top holdings</div>
        <div className="w-10 shrink-0" aria-hidden />
      </div>

      {rows.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          prefetch={false}
          className={`grid ${colLayout} h-[60px] max-h-[60px] items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50`}
        >
          <div className="flex justify-center">
            {r.avatarSrc ? (
              <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] bg-[#F4F4F5] ring-1 ring-white">
                <Image
                  src={r.avatarSrc}
                  alt={r.displayName}
                  width={40}
                  height={40}
                  className="object-cover"
                  sizes="40px"
                />
              </span>
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]"
                aria-hidden
              >
                <UserRound className="h-5 w-5" strokeWidth={1.75} />
              </span>
            )}
          </div>

          <div className="min-w-0 text-left">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{r.displayName}</div>
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

          <div className="flex min-w-0 items-center gap-1.5">
            {r.topIssuers.slice(0, 5).map((issuer) => (
              <CompanyLogo key={issuer} name={issuer} logoUrl="" size="xs" />
            ))}
          </div>

          <div className="flex w-10 shrink-0 items-center justify-center text-[#A1A1AA]">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </div>
        </Link>
      ))}
    </div>
  );
}

export const SuperinvestorsFundTable = memo(SuperinvestorsFundTableInner);
