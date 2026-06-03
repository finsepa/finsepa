import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

import { Superinvestor13fProfileTabs } from "@/components/superinvestors/superinvestor-13f-profile-tabs";
import { SuperinvestorFollowButton } from "@/components/superinvestors/superinvestor-follow-button";
import { SuperinvestorProfileAvatar } from "@/components/superinvestors/superinvestor-profile-avatar";
import type { Berkshire13fComparisonPayload, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";
import { formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";

export type Superinvestor13fProfileProps = {
  profileSlug: string;
  profileName: string;
  /** Breadcrumb segment after Superinvestors (e.g. Warren Buffett). */
  breadcrumbCurrentLabel: string;
  /** Public path under `/public`. When omitted, a generic placeholder is shown. */
  avatarSrc?: string | null;
  data: Berkshire13fComparisonPayload;
  transactions: SuperinvestorTransactionsPayload;
};

/** SEC filer line → readable subtitle (e.g. `BERKSHIRE HATHAWAY INC` → `Berkshire Hathaway`). */
function filerSubtitle(secName: string): string {
  const words = secName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const joined = words.join(" ");
  return joined.replace(/\s+Inc\.?$/i, "").trim() || joined;
}

/** Match design: `$279.2 B` (space before unit suffix); mantissa ≤ 4 significant digits. */
function formatSizeForHeader(n: number): string {
  return formatUsdCompactSigDigits(n, 4).replace(/(\$[\d.]+)([KMBT])$/, "$1 $2");
}

function formatLastUpdateLabel(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return ymd.trim();
  return format(d, "MMM d, yyyy");
}

export function Superinvestor13fProfile({
  profileSlug,
  profileName,
  breadcrumbCurrentLabel,
  avatarSrc,
  data,
  transactions,
}: Superinvestor13fProfileProps) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <nav aria-label="Breadcrumb" className="flex items-center">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/superinvestors" className="transition-colors hover:text-[#09090B]">
            Superinvestors
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-medium text-[#09090B]" aria-current="page">
            {breadcrumbCurrentLabel}
          </span>
        </div>
      </nav>

      <header className="mt-8">
        <div className="flex h-fit flex-wrap items-center gap-4 sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <SuperinvestorProfileAvatar src={avatarSrc?.trim() ?? ""} name={profileName} />
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[#09090B]">{profileName}</h1>
              <p className="mt-0.5 text-[14px] font-normal leading-5 text-[#71717A]">
                {filerSubtitle(data.filerDisplayName)}
              </p>
            </div>
          </div>
          <SuperinvestorFollowButton className="w-full sm:w-auto" />
        </div>

        {/* ── Mobile: label left / value right on each row ── */}
        <dl className="mt-4 flex flex-col gap-2.5 sm:hidden">
          <div className="flex items-baseline justify-between">
            <dt className="text-[14px] font-normal leading-5 text-[#71717A]">Size</dt>
            <dd className="text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
              {formatSizeForHeader(data.totalValueUsd)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[14px] font-normal leading-5 text-[#71717A]">No. of stocks</dt>
            <dd className="text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
              {data.positionCount.toLocaleString("en-US")} {data.positionCount === 1 ? "Stock" : "Stocks"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[14px] font-normal leading-5 text-[#71717A]">Last update</dt>
            <dd className="text-[14px] font-semibold leading-5 text-[#09090B]">
              {formatLastUpdateLabel(data.current.filingDate ?? data.current.reportDate)}
            </dd>
          </div>
        </dl>
        {/* ── Desktop: horizontal with dividers ── */}
        <dl className="mt-3 hidden max-w-3xl sm:flex sm:flex-row sm:items-stretch sm:gap-0">
          <div className="flex h-fit flex-1 flex-col gap-1 border-r border-[#E4E4E7] pr-8 py-1">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Size</dt>
            <dd className="text-[20px] font-semibold leading-7 tabular-nums text-[#09090B]">
              {formatSizeForHeader(data.totalValueUsd)}
            </dd>
          </div>
          <div className="flex flex-1 flex-col gap-1 border-r border-[#E4E4E7] px-8 py-1">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">No. of stocks</dt>
            <dd className="text-[20px] font-semibold leading-7 tabular-nums text-[#09090B]">
              {data.positionCount.toLocaleString("en-US")} {data.positionCount === 1 ? "Stock" : "Stocks"}
            </dd>
          </div>
          <div className="flex flex-1 flex-col gap-1 pl-8 py-1">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Last update</dt>
            <dd className="text-[20px] font-semibold leading-7 text-[#09090B]">
              {formatLastUpdateLabel(data.current.filingDate ?? data.current.reportDate)}
            </dd>
          </div>
        </dl>
      </header>

      {data.source === "unavailable" ? (
        <p className="mt-4 max-w-3xl text-sm text-[#71717A]">
          13F holdings could not be loaded from the SEC right now. Try again later, or verify the filer has recent
          13F-HR filings.
        </p>
      ) : null}

      <Superinvestor13fProfileTabs
        profileSlug={profileSlug}
        profileName={profileName}
        data={data}
        transactions={transactions}
      />
    </div>
  );
}
