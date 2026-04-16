import Image from "next/image";
import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

import { Berkshire13fComparisonTable } from "@/components/superinvestors/berkshire-13f-comparison-table";
import type { Berkshire13fComparisonPayload } from "@/lib/superinvestors/types";
import { formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";

export type Superinvestor13fProfileProps = {
  profileName: string;
  /** Breadcrumb segment after Superinvestors (e.g. Warren Buffett). */
  breadcrumbCurrentLabel: string;
  /** Public path under `/public`. When omitted, a generic placeholder is shown. */
  avatarSrc?: string | null;
  data: Berkshire13fComparisonPayload;
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
  profileName,
  breadcrumbCurrentLabel,
  avatarSrc,
  data,
}: Superinvestor13fProfileProps) {
  return (
    <div className="px-9 py-6">
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
        <div className="flex h-fit items-center gap-4">
          {avatarSrc ? (
            <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] bg-[#F4F4F5] ring-1 ring-white">
              <Image
                src={avatarSrc}
                alt={profileName}
                width={56}
                height={56}
                className="h-full w-full object-cover"
                sizes="56px"
                priority
              />
            </span>
          ) : (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]"
              aria-hidden
            >
              <UserRound className="h-8 w-8" strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[#09090B]">{profileName}</h1>
            <p className="mt-0.5 text-[14px] font-normal leading-5 text-[#71717A]">
              {filerSubtitle(data.filerDisplayName)}
            </p>
          </div>
        </div>

        <dl className="mt-3 flex max-w-3xl flex-col gap-0 sm:flex-row sm:items-stretch">
          <div className="flex h-fit flex-1 flex-col gap-1 py-1 sm:border-r sm:border-[#E4E4E7] sm:pr-8">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Size</dt>
            <dd className="text-[20px] font-semibold leading-7 tabular-nums text-[#09090B]">
              {formatSizeForHeader(data.totalValueUsd)}
            </dd>
          </div>
          <div className="flex flex-1 flex-col gap-1 border-t border-[#E4E4E7] py-4 sm:border-t-0 sm:border-r sm:border-[#E4E4E7] sm:px-8 sm:py-1">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">No. of stocks</dt>
            <dd className="text-[20px] font-semibold leading-7 tabular-nums text-[#09090B]">
              {data.positionCount.toLocaleString("en-US")} {data.positionCount === 1 ? "Stock" : "Stocks"}
            </dd>
          </div>
          <div className="flex flex-1 flex-col gap-1 border-t border-[#E4E4E7] py-4 sm:border-t-0 sm:pl-8 sm:py-1">
            <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Last update</dt>
            <dd className="text-[20px] font-semibold leading-7 text-[#09090B]">
              {formatLastUpdateLabel(data.current.filingDate)}
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

      {!data.hasPriorFiling && data.source !== "unavailable" ? (
        <p className="mt-4 max-w-3xl text-sm text-[#71717A]">
          Only one 13F-HR filing appears in the SEC feed; change badges and prior columns are hidden until a second
          filing is available.
        </p>
      ) : null}

      <div className="mt-8">
        <Berkshire13fComparisonTable rows={data.rows} hasPriorFiling={data.hasPriorFiling} />
      </div>
    </div>
  );
}
